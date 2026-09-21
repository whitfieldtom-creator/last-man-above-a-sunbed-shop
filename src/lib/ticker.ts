import { prisma } from "@/lib/db";
import { getLastFinishedRun } from "@/lib/runs";
import { getCurrentGameWeek } from "@/lib/session";

type LastRun = Awaited<ReturnType<typeof getLastFinishedRun>>;

// What the vidiprinter ticker says right now:
// - first week of a run: the previous run's winner(s)
// - later weeks: last settled week's news — full eliminations, then league
//   lives lost by players who are still in
export async function tickerContentFor(
  gameWeek: { runId: number; weekNumber: number } | null,
  lastRun: LastRun
): Promise<string> {
  if (!gameWeek) return "SEASON UNDERWAY";

  if (gameWeek.weekNumber === 1) {
    if (lastRun && lastRun.winners.length > 0) {
      const names = lastRun.winners.map((w) => w.name.toUpperCase()).join(" & ");
      return `${names} WIN${lastRun.winners.length === 1 ? "S" : ""} RUN ${lastRun.runNumber}!`;
    }
    return "WEEK 1 UNDERWAY";
  }

  const settledWeek = await prisma.gameWeek.findFirst({
    where: { runId: gameWeek.runId, status: "settled" },
    orderBy: { weekNumber: "desc" },
  });
  if (!settledWeek) return `WEEK ${gameWeek.weekNumber} UNDERWAY`;
  if (settledWeek.lmsSkipped) return "LMS WAS SKIPPED LAST WEEK  ***  NOBODY LOST A LIFE";

  const [eliminated, lostLives] = await Promise.all([
    prisma.runEntry.findMany({
      where: { runId: gameWeek.runId, eliminatedAtWeekId: settledWeek.id },
      include: { player: true },
      orderBy: { playerId: "asc" },
    }),
    prisma.playerLeagueLife.findMany({
      where: { runId: gameWeek.runId, lostAtWeekId: settledWeek.id },
      include: { player: true, league: true },
      orderBy: [{ playerId: "asc" }, { leagueId: "asc" }],
    }),
  ]);

  const eliminatedIds = new Set(eliminated.map((e) => e.playerId));
  const items = eliminated.map((e) => `${e.player.name.toUpperCase()} ELIMINATED`);

  // Someone who was knocked out entirely is already announced above, so
  // only list league losses for players still in the run.
  const leaguesLostByPlayer = new Map<number, { name: string; leagues: string[] }>();
  for (const life of lostLives) {
    if (eliminatedIds.has(life.playerId)) continue;
    const entry = leaguesLostByPlayer.get(life.playerId) ?? { name: life.player.name.toUpperCase(), leagues: [] };
    entry.leagues.push(life.league.name.toUpperCase());
    leaguesLostByPlayer.set(life.playerId, entry);
  }
  for (const { name, leagues } of leaguesLostByPlayer.values()) {
    items.push(`${name} OUT OF ${leagues.join(" & ")}`);
  }

  return items.length > 0 ? items.join("  ***  ") : "NOBODY LOST A LIFE LAST WEEK";
}

export async function getTickerContent(): Promise<string> {
  const [gameWeek, lastRun] = await Promise.all([getCurrentGameWeek(), getLastFinishedRun()]);
  return tickerContentFor(gameWeek, lastRun);
}
