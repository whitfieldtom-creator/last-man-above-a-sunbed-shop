import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentGameWeek, getCurrentPlayer } from "@/lib/session";
import PredictorPickForm from "./PredictorPickForm";

// Screen 3: Score Predictor — same 5 fixtures for every player.
// See last-man-standing-plan.md section 3.
export const dynamic = "force-dynamic";

export default async function PredictorPickPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  const gameWeek = await getCurrentGameWeek();
  if (!gameWeek) {
    return (
      <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
        <h1>Score Predictor</h1>
        <p>No game week open right now — check back after the next pull.</p>
      </main>
    );
  }

  const predictorFixtures = await prisma.predictorFixture.findMany({
    where: { gameWeekId: gameWeek.id },
    include: { fixture: true },
    orderBy: { fixture: { kickoffTime: "asc" } },
  });

  const existingRows = await prisma.predictorPick.findMany({
    where: { playerId: player.id, predictorFixtureId: { in: predictorFixtures.map((pf) => pf.id) } },
  });
  const existingPicks = Object.fromEntries(
    existingRows.map((p) => [p.predictorFixtureId, { homeScore: p.predictedHomeScore, awayScore: p.predictedAwayScore }])
  );

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Score Predictor</h1>
      <p>{player.name}</p>
      <PredictorPickForm
        fixtures={predictorFixtures.map((pf) => ({
          predictorFixtureId: pf.id,
          homeTeam: pf.fixture.homeTeam,
          awayTeam: pf.fixture.awayTeam,
        }))}
        existingPicks={existingPicks}
        deadlineIso={gameWeek.pickDeadline.toISOString()}
      />
    </main>
  );
}
