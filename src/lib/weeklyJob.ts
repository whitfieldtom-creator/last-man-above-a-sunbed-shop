import { prisma } from "@/lib/db";
import { pullFixturesForGameWeek, selectPredictorFixtures } from "@/lib/fixtures";
import { settleLmsGameWeek, STARTING_LIVES } from "@/lib/lms";

// A Fri-Thu window is 6 days; the cron fires every 7. So the window pulled
// this Monday is still mid-flight on the very next Monday, and only becomes
// settleable once its Thursday has actually passed — this naturally lags by
// about a cycle at first and then self-corrects. See last-man-standing-plan.md
// sections 1 and 11.
function nextFridayThroughThursday(referenceDate: Date): { windowStart: Date; windowEnd: Date } {
  const today = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  const day = today.getUTCDay(); // 0=Sun..6=Sat, Fri=5
  let daysUntilFriday = (5 - day + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7; // if today IS Friday, use next week's

  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() + daysUntilFriday);

  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 6); // Thursday
  windowEnd.setUTCHours(23, 59, 59, 999);

  return { windowStart, windowEnd };
}

// Midday UK time, expressed as UTC — handles BST/GMT without a timezone
// library by asking Intl what the London wall-clock hour is at UTC noon.
function ukNoonUtc(calendarDate: Date): Date {
  const utcNoon = new Date(Date.UTC(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth(), calendarDate.getUTCDate(), 12, 0, 0));
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(utcNoon)
  );
  const offsetHours = londonHour - 12;
  return new Date(utcNoon.getTime() - offsetHours * 60 * 60 * 1000);
}

async function getOrCreateActiveRun() {
  const existing = await prisma.run.findFirst({ where: { endedAt: null }, orderBy: { runNumber: "desc" } });
  if (existing) return existing;

  const lastRun = await prisma.run.findFirst({ orderBy: { runNumber: "desc" } });
  const run = await prisma.run.create({ data: { runNumber: (lastRun?.runNumber ?? 0) + 1 } });

  const players = await prisma.player.findMany();
  await prisma.runEntry.createMany({
    data: players.map((player) => ({ runId: run.id, playerId: player.id, livesRemaining: STARTING_LIVES })),
  });

  return run;
}

async function getOrCreateGameWeek(runId: number, windowStart: Date, windowEnd: Date) {
  const existing = await prisma.gameWeek.findFirst({ where: { runId, windowStart } });
  if (existing) return existing;

  const lastWeek = await prisma.gameWeek.findFirst({ where: { runId }, orderBy: { weekNumber: "desc" } });
  return prisma.gameWeek.create({
    data: {
      runId,
      weekNumber: (lastWeek?.weekNumber ?? 0) + 1,
      windowStart,
      windowEnd,
      pickDeadline: ukNoonUtc(windowStart),
    },
  });
}

// The full Monday job: settle whichever past game weeks have actually
// finished, then pull the upcoming Fri-Thu window. Safe to call more than
// once for the same Monday (idempotent) and safe to call after a missed
// week or two (settles everything that's become due, oldest first).
export async function runWeeklySettleAndPull(referenceDate = new Date()) {
  const settledWeekIds: number[] = [];
  const skippedWeekIds: number[] = [];

  const runForSettlement = await getOrCreateActiveRun();

  const duePastWeeks = await prisma.gameWeek.findMany({
    where: { runId: runForSettlement.id, status: { in: ["open", "locked"] }, windowEnd: { lt: referenceDate } },
    orderBy: { weekNumber: "asc" },
  });

  for (const week of duePastWeeks) {
    await pullFixturesForGameWeek(week.id); // re-sync final scores before settling

    const pickCount = await prisma.lmsPick.count({ where: { gameWeekId: week.id } });
    if (pickCount === 0) {
      // Nobody could have picked (e.g. the pick screens didn't exist yet
      // when this window was live) — don't cost anyone a life for it.
      await prisma.gameWeek.update({ where: { id: week.id }, data: { status: "skipped" } });
      skippedWeekIds.push(week.id);
      continue;
    }

    await settleLmsGameWeek(week.id);
    // TODO: settle Predictor scoring for this week (not implemented yet)
    settledWeekIds.push(week.id);
  }

  // Settlement above may have just ended the run (down to 1 or 0 survivors),
  // so re-resolve the active run before pulling the upcoming window.
  const runForPull = await getOrCreateActiveRun();
  const { windowStart, windowEnd } = nextFridayThroughThursday(referenceDate);
  const gameWeek = await getOrCreateGameWeek(runForPull.id, windowStart, windowEnd);
  const fixtureCount = await pullFixturesForGameWeek(gameWeek.id);

  if (fixtureCount === 0) {
    // Zero leagues playing this window (e.g. an international break) —
    // see last-man-standing-plan.md section 2.
    await prisma.gameWeek.update({ where: { id: gameWeek.id }, data: { status: "skipped" } });
  } else {
    await selectPredictorFixtures(gameWeek.id);
  }

  return {
    settledWeekIds,
    skippedPastWeekIds: skippedWeekIds,
    pulledGameWeekId: gameWeek.id,
    pulledFixtureCount: fixtureCount,
  };
}
