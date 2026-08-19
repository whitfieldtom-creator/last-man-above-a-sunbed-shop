import { prisma } from "@/lib/db";

// See last-man-standing-plan.md section 6.
export const STARTING_LIVES = 4;

// See section 6a — the run's points pot grows by this many points per game
// week that passes (settled or skipped, doesn't matter), and pays out 60% /
// 25% / 15% to whoever survived longest / 2nd-longest / 3rd-longest once
// the run ends.
const POINTS_PER_WEEK = 4;
const PAYOUT_TIER_PERCENTAGES = [60, 25, 15];

function isPickCorrect(
  teamPicked: string,
  fixture: { result: string; homeTeam: string; awayTeam: string }
): boolean {
  if (fixture.result === "home") return teamPicked === fixture.homeTeam;
  if (fixture.result === "away") return teamPicked === fixture.awayTeam;
  // draw, postponed, or still pending at settlement time all count as wrong
  return false;
}

// Ranks a finished run's entries by how long each player survived (still-in
// winners rank highest, then eliminated players grouped by week, most
// recent first), then pays the points pot out 60/25/15 across those ranks.
// Players tied for a rank absorb as many consecutive tiers as there are
// people tied, pool those percentages, and split the pool evenly — e.g. two
// joint winners split 60+25=85% between them, and whoever's next takes the
// remaining 15% as "3rd", not "2nd".
async function awardLmsPayouts(runId: number) {
  const [entries, weeks] = await Promise.all([
    prisma.runEntry.findMany({
      where: { runId },
      select: { id: true, eliminated: true, eliminatedAtWeekId: true },
    }),
    prisma.gameWeek.findMany({ where: { runId }, select: { id: true, weekNumber: true } }),
  ]);

  const weekNumberById = new Map(weeks.map((w) => [w.id, w.weekNumber]));
  const maxWeekNumber = weeks.reduce((max, w) => Math.max(max, w.weekNumber), 0);
  const pot = maxWeekNumber * POINTS_PER_WEEK;

  const winners = entries.filter((e) => !e.eliminated);

  const eliminatedByWeek = new Map<number, typeof entries>();
  for (const entry of entries) {
    if (entry.eliminated && entry.eliminatedAtWeekId !== null) {
      const list = eliminatedByWeek.get(entry.eliminatedAtWeekId) ?? [];
      list.push(entry);
      eliminatedByWeek.set(entry.eliminatedAtWeekId, list);
    }
  }
  const eliminatedGroupsDescending = [...eliminatedByWeek.entries()]
    .sort((a, b) => (weekNumberById.get(b[0]) ?? 0) - (weekNumberById.get(a[0]) ?? 0))
    .map(([, group]) => group);

  const rankedGroups = winners.length > 0 ? [winners, ...eliminatedGroupsDescending] : eliminatedGroupsDescending;

  const payoutByEntryId = new Map<number, number>();
  let tiersConsumed = 0;
  for (const group of rankedGroups) {
    if (tiersConsumed >= PAYOUT_TIER_PERCENTAGES.length) break;
    const tiersForGroup = Math.min(group.length, PAYOUT_TIER_PERCENTAGES.length - tiersConsumed);
    const percentSum = PAYOUT_TIER_PERCENTAGES.slice(tiersConsumed, tiersConsumed + tiersForGroup).reduce(
      (a, b) => a + b,
      0
    );
    const pointsPerPerson = (pot * percentSum) / 100 / group.length;
    for (const entry of group) payoutByEntryId.set(entry.id, pointsPerPerson);
    tiersConsumed += tiersForGroup;
  }

  for (const entry of entries) {
    await prisma.runEntry.update({
      where: { id: entry.id },
      data: { lmsPointsAwarded: payoutByEntryId.get(entry.id) ?? 0 },
    });
  }
}

// Settles one game week: scores each LMS pick against its fixture result,
// applies the lives rule (each wrong/missing pick costs a life, a wrong
// pick while already at 0 lives eliminates), and closes out the run if
// it's down to one survivor or everyone still in it goes out together.
export async function settleLmsGameWeek(gameWeekId: number) {
  const gameWeek = await prisma.gameWeek.findUniqueOrThrow({
    where: { id: gameWeekId },
    include: {
      fixtures: true,
      lmsPicks: { include: { fixture: true } },
    },
  });

  const leagueIdsThisWeek = [...new Set(gameWeek.fixtures.map((f) => f.leagueId))];

  const picksByPlayer = new Map<number, typeof gameWeek.lmsPicks>();
  for (const pick of gameWeek.lmsPicks) {
    const list = picksByPlayer.get(pick.playerId) ?? [];
    list.push(pick);
    picksByPlayer.set(pick.playerId, list);
  }

  for (const pick of gameWeek.lmsPicks) {
    const correct = isPickCorrect(pick.teamPicked, pick.fixture);
    if (pick.correct !== correct) {
      await prisma.lmsPick.update({ where: { id: pick.id }, data: { correct } });
    }
  }

  const activeEntries = await prisma.runEntry.findMany({
    where: { runId: gameWeek.runId, eliminated: false },
  });

  const eliminatedThisWeek: number[] = [];

  for (const entry of activeEntries) {
    const picks = picksByPlayer.get(entry.playerId) ?? [];
    const pickedLeagueIds = new Set(picks.map((p) => p.leagueId));
    const missingPicks = leagueIdsThisWeek.filter((id) => !pickedLeagueIds.has(id)).length;
    const wrongPicks = picks.filter((p) => !isPickCorrect(p.teamPicked, p.fixture)).length;
    const totalMisses = missingPicks + wrongPicks;

    let lives = entry.livesRemaining;
    let eliminated = false;
    for (let i = 0; i < totalMisses; i++) {
      if (lives === 0) {
        eliminated = true;
        break;
      }
      lives -= 1;
    }

    await prisma.runEntry.update({
      where: { id: entry.id },
      data: {
        livesRemaining: lives,
        eliminated,
        eliminatedAtWeekId: eliminated ? gameWeek.id : null,
      },
    });

    if (eliminated) eliminatedThisWeek.push(entry.playerId);
  }

  await prisma.gameWeek.update({ where: { id: gameWeek.id }, data: { status: "settled" } });

  const stillActiveCount = await prisma.runEntry.count({
    where: { runId: gameWeek.runId, eliminated: false },
  });

  if (stillActiveCount === 0 && eliminatedThisWeek.length > 0) {
    // Everyone who was still in it went out the same week — joint winners.
    await prisma.run.update({
      where: { id: gameWeek.runId },
      data: {
        endedAt: new Date(),
        winners: { connect: eliminatedThisWeek.map((id) => ({ id })) },
      },
    });
    await awardLmsPayouts(gameWeek.runId);
  } else if (stillActiveCount === 1) {
    const [survivor] = await prisma.runEntry.findMany({
      where: { runId: gameWeek.runId, eliminated: false },
      select: { playerId: true },
    });
    await prisma.run.update({
      where: { id: gameWeek.runId },
      data: {
        endedAt: new Date(),
        winners: { connect: [{ id: survivor.playerId }] },
      },
    });
    await awardLmsPayouts(gameWeek.runId);
  }
}
