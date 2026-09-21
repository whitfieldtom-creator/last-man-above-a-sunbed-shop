import { prisma } from "@/lib/db";
import { pullFixturesForGameWeek, refreshFixtureResults, selectPredictorFixtures } from "@/lib/fixtures";
import { refreshLmsSkipFlag, settleLmsGameWeek } from "@/lib/lms";
import { settlePredictorGameWeek } from "@/lib/predictor";

// A Fri-Mon window is 4 days, pulled every Tuesday (7-day cadence) — by the
// time next Tuesday's job runs, this window's Monday has always already
// passed (windowEnd = Tuesday+6, next run = Tuesday+7), so unlike the old
// Fri-Thu design this never lags a cycle behind. See last-man-standing-plan.md
// sections 1 and 11.
function nextFridayThroughMonday(referenceDate: Date): { windowStart: Date; windowEnd: Date } {
  const today = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
  const day = today.getUTCDay(); // 0=Sun..6=Sat, Fri=5
  let daysUntilFriday = (5 - day + 7) % 7;
  if (daysUntilFriday === 0) daysUntilFriday = 7; // if today IS Friday, use next week's

  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() + daysUntilFriday);

  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 3); // Monday
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

  const [players, leagues] = await Promise.all([prisma.player.findMany(), prisma.league.findMany()]);
  await prisma.runEntry.createMany({
    data: players.map((player) => ({ runId: run.id, playerId: player.id })),
  });
  // One life per league per player (section 6) — everyone starts alive in all four.
  await prisma.playerLeagueLife.createMany({
    data: players.flatMap((player) =>
      leagues.map((league) => ({ runId: run.id, playerId: player.id, leagueId: league.id }))
    ),
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

// The full Tuesday job: settle whichever past game weeks have actually
// finished, then pull the upcoming Fri-Mon window. Safe to call more than
// once for the same Tuesday (idempotent) and safe to call after a missed
// week or two (settles everything that's become due, oldest first).
export async function runWeeklySettleAndPull(referenceDate = new Date()) {
  const settledWeekIds: number[] = [];

  const runForSettlement = await getOrCreateActiveRun();

  const duePastWeeks = await prisma.gameWeek.findMany({
    where: { runId: runForSettlement.id, status: { in: ["open", "locked"] }, windowEnd: { lt: referenceDate } },
    orderBy: { weekNumber: "asc" },
  });

  for (const week of duePastWeeks) {
    await refreshFixtureResults(week.id); // re-sync final scores before settling, by fixture id (see fixtures.ts)

    // A week with zero LMS picks is no longer automatically a technical
    // failure to skip — under the per-league rules it can legitimately
    // happen (e.g. every surviving player's only remaining life is in a
    // league that isn't playing this week). settleLmsGameWeek handles that
    // correctly on its own (per-league misses, thin-week no-penalty, and
    // the thin-week wipeout exception), so it always runs.
    await settleLmsGameWeek(week.id);
    settledWeekIds.push(week.id);

    await settlePredictorGameWeek(week.id);
  }

  // Settlement above may have just ended the run (down to 1 or 0 survivors),
  // so re-resolve the active run before pulling the upcoming window.
  const runForPull = await getOrCreateActiveRun();
  const { windowStart, windowEnd } = nextFridayThroughMonday(referenceDate);
  const gameWeek = await getOrCreateGameWeek(runForPull.id, windowStart, windowEnd);
  const fixtureCount = await pullFixturesForGameWeek(gameWeek.id);

  // Two or more idle leagues => LMS is skipped this week, Predictor still on
  // (section 2). Recomputed on every run so a retried pull corrects it.
  await refreshLmsSkipFlag(gameWeek.id);

  if (fixtureCount === 0) {
    // Zero leagues playing this window (e.g. an international break) —
    // see last-man-standing-plan.md section 2.
    await prisma.gameWeek.update({ where: { id: gameWeek.id }, data: { status: "skipped" } });
  } else {
    await selectPredictorFixtures(gameWeek.id);
  }

  return {
    settledWeekIds,
    pulledGameWeekId: gameWeek.id,
    pulledFixtureCount: fixtureCount,
  };
}
