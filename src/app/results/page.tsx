import Link from "next/link";
import { prisma } from "@/lib/db";

// Screen 5: Results / leaderboard — LMS run status + Predictor points table.
// See last-man-standing-plan.md section 3 and section 6 for the lives rule.
// Always reads current picks/eliminations, so it can't be statically prerendered.
export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const activeRun = await prisma.run.findFirst({
    where: { endedAt: null },
    orderBy: { runNumber: "desc" },
    include: {
      runEntries: {
        include: { player: true },
        orderBy: [{ eliminated: "asc" }, { player: { name: "asc" } }],
      },
    },
  });

  // Per-league life status (section 6) — fixed league order via league id,
  // same order every player is seeded into (see prisma/seed.ts).
  const leagues = await prisma.league.findMany({ orderBy: { id: "asc" } });
  const leagueLives = activeRun
    ? await prisma.playerLeagueLife.findMany({ where: { runId: activeRun.id } })
    : [];
  const aliveByPlayerAndLeague = new Map(leagueLives.map((l) => [`${l.playerId}:${l.leagueId}`, l.alive]));

  const LEAGUE_ABBREVIATIONS: Record<string, string> = {
    "Premier League": "PL",
    Championship: "CH",
    "League One": "L1",
    "League Two": "L2",
  };

  const pastRuns = await prisma.run.findMany({
    where: { endedAt: { not: null } },
    orderBy: { runNumber: "desc" },
    include: { winners: true },
  });

  const players = await prisma.player.findMany({ orderBy: { id: "asc" } });
  const pointTotals = await prisma.predictorPick.groupBy({
    by: ["playerId"],
    where: { pointsAwarded: { not: null } },
    _sum: { pointsAwarded: true },
  });
  const pointsByPlayerId = new Map(pointTotals.map((t) => [t.playerId, t._sum.pointsAwarded ?? 0]));
  const predictorLeaderboard = players
    .map((player) => ({ player, points: pointsByPlayerId.get(player.id) ?? 0 }))
    .sort((a, b) => b.points - a.points);

  // Season-long LMS points pot payouts — see plan section 6a. Only
  // completed runs contribute (lmsPointsAwarded is null mid-run).
  const lmsPointTotals = await prisma.runEntry.groupBy({
    by: ["playerId"],
    where: { lmsPointsAwarded: { not: null } },
    _sum: { lmsPointsAwarded: true },
  });
  const lmsPointsByPlayerId = new Map(lmsPointTotals.map((t) => [t.playerId, t._sum.lmsPointsAwarded ?? 0]));
  const lmsPointsLeaderboard = players
    .map((player) => ({ player, points: lmsPointsByPlayerId.get(player.id) ?? 0 }))
    .sort((a, b) => b.points - a.points);
  const formatPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  return (
    <main>
      <p className="eyebrow">Screen 5</p>
      <h2>Results</h2>

      <section>
        <p className="eyebrow" style={{ marginTop: "1.25rem" }}>
          Last Man Standing
        </p>
        {!activeRun ? (
          <p className="text-muted">No run in progress.</p>
        ) : (
          <div className="panel">
            <p className="text-faint" style={{ marginBottom: "0.5rem" }}>
              Run #{activeRun.runNumber}
            </p>
            <div className="results-table-wrap">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    {leagues.map((league) => (
                      <th key={league.id} title={league.name}>
                        {LEAGUE_ABBREVIATIONS[league.name] ?? league.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeRun.runEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className={entry.eliminated ? "text-muted" : undefined}>{entry.player.name}</td>
                      {leagues.map((league) => {
                        const alive = aliveByPlayerAndLeague.get(`${entry.playerId}:${league.id}`) ?? false;
                        return (
                          <td
                            key={league.id}
                            className={alive ? "results-table__status--alive" : "results-table__status--out"}
                          >
                            {alive ? "Alive" : "Out"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {pastRuns.length > 0 && (
          <>
            <p className="eyebrow" style={{ marginTop: "1.25rem" }}>
              Past run winners
            </p>
            <ul className="list panel">
              {pastRuns.map((run) => (
                <li key={run.id} className="list-row">
                  <span className="text-faint">Run #{run.runNumber}</span>
                  <span>{run.winners.map((w) => w.name).join(" & ") || "no winner"}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <p className="eyebrow" style={{ marginTop: "1.5rem" }}>
          Score Predictor
        </p>
        <ul className="list panel">
          {predictorLeaderboard.map(({ player, points }, i) => (
            <li key={player.id} className="list-row">
              <span>
                <span className="text-faint">{i + 1}.</span> {player.name}
              </span>
              <span className="text-faint">
                {points} {points === 1 ? "point" : "points"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="eyebrow" style={{ marginTop: "1.5rem" }}>
          LMS Points (season)
        </p>
        <ul className="list panel">
          {lmsPointsLeaderboard.map(({ player, points }, i) => (
            <li key={player.id} className="list-row">
              <span>
                <span className="text-faint">{i + 1}.</span> {player.name}
              </span>
              <span className="text-faint">
                {formatPoints(points)} {points === 1 ? "point" : "points"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/menu" className="link-btn">
        ← Back to menu
      </Link>
    </main>
  );
}
