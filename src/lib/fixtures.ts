import { prisma } from "@/lib/db";
import { getNextRound, getRoundFixtures, type SportsDbEvent } from "@/lib/sportsdb";

// See last-man-standing-plan.md section 11.
const LEAGUE_SPORTSDB_IDS: Record<string, string> = {
  "Premier League": "4328",
  Championship: "4329",
  "League One": "4396",
  "League Two": "4397",
};

const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const POSTPONED_STATUSES = new Set(["PPD", "CANC", "ABD", "Postponed", "Cancelled"]);

// English season string TheSportsDB expects, e.g. "2026-2027" — the season
// that starts in the August of `date`'s year (or the previous August, if
// `date` falls before July).
export function seasonForDate(date: Date): string {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 6 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

function mapEventStatus(event: SportsDbEvent): {
  result: "pending" | "home" | "away" | "draw" | "postponed";
  homeScore: number | null;
  awayScore: number | null;
} {
  if (FINISHED_STATUSES.has(event.strStatus)) {
    const homeScore = Number(event.intHomeScore);
    const awayScore = Number(event.intAwayScore);
    const result = homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "draw";
    return { result, homeScore, awayScore };
  }
  if (POSTPONED_STATUSES.has(event.strStatus)) {
    return { result: "postponed", homeScore: null, awayScore: null };
  }
  return { result: "pending", homeScore: null, awayScore: null };
}

// Pulls fixtures for every league into `gameWeekId`'s Fri-Mon window, and
// re-syncs results for fixtures already stored there (same call covers both
// pulling and settling — see section 11). Returns the number of fixtures
// created or updated.
export async function pullFixturesForGameWeek(gameWeekId: number): Promise<number> {
  const gameWeek = await prisma.gameWeek.findUniqueOrThrow({ where: { id: gameWeekId } });
  const leagues = await prisma.league.findMany();
  const season = seasonForDate(gameWeek.windowStart);

  let count = 0;

  for (const league of leagues) {
    const sportsDbId = LEAGUE_SPORTSDB_IDS[league.name];
    if (!sportsDbId) continue;

    const nextRound = await getNextRound(sportsDbId);
    if (nextRound === null) continue;

    const [roundEvents, nextRoundEvents] = await Promise.all([
      getRoundFixtures(sportsDbId, nextRound, season),
      getRoundFixtures(sportsDbId, nextRound + 1, season),
    ]);

    const events = [...roundEvents, ...nextRoundEvents].filter((event) => {
      const eventDate = new Date(event.dateEvent);
      return eventDate >= gameWeek.windowStart && eventDate <= gameWeek.windowEnd;
    });

    for (const event of events) {
      const { result, homeScore, awayScore } = mapEventStatus(event);
      await prisma.fixture.upsert({
        where: { externalId: event.idEvent },
        update: { result, homeScore, awayScore },
        create: {
          gameWeekId: gameWeek.id,
          leagueId: league.id,
          homeTeam: event.strHomeTeam,
          awayTeam: event.strAwayTeam,
          kickoffTime: new Date(`${event.strTimestamp}Z`),
          externalId: event.idEvent,
          result,
          homeScore,
          awayScore,
        },
      });
      count++;
    }
  }

  return count;
}

// Randomly picks 5 of the game week's fixtures for the Score Predictor.
// Per section 2, skip if there aren't enough fixtures to fill 5 picks.
export async function selectPredictorFixtures(gameWeekId: number, count = 5) {
  const existing = await prisma.predictorFixture.findMany({ where: { gameWeekId } });
  if (existing.length > 0) return existing;

  const fixtures = await prisma.fixture.findMany({ where: { gameWeekId } });
  if (fixtures.length < count) return [];

  const chosen = [...fixtures].sort(() => Math.random() - 0.5).slice(0, count);

  await prisma.predictorFixture.createMany({
    data: chosen.map((fixture) => ({ gameWeekId, fixtureId: fixture.id })),
  });

  return prisma.predictorFixture.findMany({ where: { gameWeekId } });
}
