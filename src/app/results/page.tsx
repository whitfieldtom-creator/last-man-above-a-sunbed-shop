import Link from "next/link";
import { prisma } from "@/lib/db";

// Screen 4: Results / leaderboard — LMS run status + Predictor points table.
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
        orderBy: [{ eliminated: "asc" }, { livesRemaining: "desc" }],
      },
    },
  });

  const pastRuns = await prisma.run.findMany({
    where: { endedAt: { not: null } },
    orderBy: { runNumber: "desc" },
    include: { winners: true },
  });

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Results</h1>

      <section>
        <h2>Last Man Standing</h2>
        {!activeRun ? (
          <p>No run in progress.</p>
        ) : (
          <>
            <p>Run #{activeRun.runNumber}</p>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {activeRun.runEntries.map((entry) => (
                <li key={entry.id} style={{ margin: "0.5rem 0" }}>
                  {entry.player.name} —{" "}
                  {entry.eliminated ? "eliminated" : `${entry.livesRemaining} ${entry.livesRemaining === 1 ? "life" : "lives"} left`}
                </li>
              ))}
            </ul>
          </>
        )}

        {pastRuns.length > 0 && (
          <>
            <h3>Past run winners</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {pastRuns.map((run) => (
                <li key={run.id}>
                  Run #{run.runNumber}: {run.winners.map((w) => w.name).join(" & ") || "no winner"}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>Score Predictor</h2>
        <p>Leaderboard coming soon.</p>
      </section>

      <Link href="/">Back to start</Link>
    </main>
  );
}
