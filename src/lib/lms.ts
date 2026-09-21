import { prisma } from "@/lib/db";

// See section 6a — the run's points pot grows by this many points per game
// week that passes (settled or skipped, doesn't matter), and pays out 60% /
// 25% / 15% to whoever survived longest / 2nd-longest / 3rd-longest once
// the run ends.
const POINTS_PER_WEEK = 4;
const PAYOUT_TIER_PERCENTAGES = [60, 25, 15];

// See section 2 — LMS only runs for a week if every league that anyone still
// has a life in has fixtures that week. If even one such league has none, the
// whole week's LMS is skipped (the Score Predictor still runs). A league
// nobody is alive in any more doesn't count either way.
export function shouldSkipLms(leagueIdsWithFixtures: number[], leagueIdsWithLivesLeft: number[]): boolean {
  const playing = new Set(leagueIdsWithFixtures);
  return leagueIdsWithLivesLeft.some((leagueId) => !playing.has(leagueId));
}

// Works out from a game week's stored fixtures and the run's current lives
// whether LMS is skipped, and records it. Called after every pull (which
// happens after the previous week has settled, so lives are up to date), so
// a retried pull that fills in a missing league corrects the flag.
export async function refreshLmsSkipFlag(gameWeekId: number): Promise<boolean> {
  const week = await prisma.gameWeek.findUniqueOrThrow({ where: { id: gameWeekId }, select: { runId: true } });
  const [leaguesWithFixtures, leaguesWithLivesLeft] = await Promise.all([
    prisma.fixture.findMany({ where: { gameWeekId }, distinct: ["leagueId"], select: { leagueId: true } }),
    prisma.playerLeagueLife.findMany({ where: { runId: week.runId, alive: true }, distinct: ["leagueId"], select: { leagueId: true } }),
  ]);
  const lmsSkipped = shouldSkipLms(
    leaguesWithFixtures.map((f) => f.leagueId),
    leaguesWithLivesLeft.map((l) => l.leagueId)
  );
  await prisma.gameWeek.update({ where: { id: gameWeekId }, data: { lmsSkipped } });
  return lmsSkipped;
}

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
// applies the per-league lives rule (a wrong/missing/postponed pick loses
// that league's life only — see section 6), and closes out the run if it's
// down to one survivor or everyone still in it goes out together.
export async function settleLmsGameWeek(gameWeekId: number) {
  const gameWeek = await prisma.gameWeek.findUniqueOrThrow({
    where: { id: gameWeekId },
    include: {
      fixtures: true,
      lmsPicks: { include: { fixture: true } },
    },
  });

  // LMS skipped this week (section 2): nobody picked, so nobody is scored
  // or loses a life. The week still counts as passed (it adds to the pot)
  // and the Predictor scores separately.
  if (gameWeek.lmsSkipped) {
    await prisma.gameWeek.update({ where: { id: gameWeek.id }, data: { status: "settled" } });
    return;
  }

  const leagueIdsThisWeek = new Set(gameWeek.fixtures.map((f) => f.leagueId));

  const pickByPlayerAndLeague = new Map<string, (typeof gameWeek.lmsPicks)[number]>();
  for (const pick of gameWeek.lmsPicks) {
    const correct = isPickCorrect(pick.teamPicked, pick.fixture);
    if (pick.correct !== correct) {
      await prisma.lmsPick.update({ where: { id: pick.id }, data: { correct } });
    }
    pickByPlayerAndLeague.set(`${pick.playerId}:${pick.leagueId}`, pick);
  }

  const activeEntries = await prisma.runEntry.findMany({
    where: { runId: gameWeek.runId, eliminated: false },
  });

  const aliveLeagueLives = await prisma.playerLeagueLife.findMany({
    where: { runId: gameWeek.runId, alive: true, playerId: { in: activeEntries.map((e) => e.playerId) } },
  });
  const aliveLeaguesByPlayer = new Map<number, typeof aliveLeagueLives>();
  for (const life of aliveLeagueLives) {
    const list = aliveLeaguesByPlayer.get(life.playerId) ?? [];
    list.push(life);
    aliveLeaguesByPlayer.set(life.playerId, list);
  }

  const eliminatedThisWeek: number[] = [];

  for (const entry of activeEntries) {
    const aliveLeagues = aliveLeaguesByPlayer.get(entry.playerId) ?? [];

    for (const life of aliveLeagues) {
      if (!leagueIdsThisWeek.has(life.leagueId)) continue; // this league has no fixtures this week — no pick expected, no penalty (even if it's all they have left)

      const pick = pickByPlayerAndLeague.get(`${entry.playerId}:${life.leagueId}`);
      const survived = pick ? isPickCorrect(pick.teamPicked, pick.fixture) : false;
      if (!survived) {
        await prisma.playerLeagueLife.update({ where: { id: life.id }, data: { alive: false, lostAtWeekId: gameWeek.id } });
      }
    }

    const remainingAlive = await prisma.playerLeagueLife.count({
      where: { runId: gameWeek.runId, playerId: entry.playerId, alive: true },
    });
    if (remainingAlive === 0) {
      await prisma.runEntry.update({
        where: { id: entry.id },
        data: { eliminated: true, eliminatedAtWeekId: gameWeek.id },
      });
      eliminatedThisWeek.push(entry.playerId);
    }
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
