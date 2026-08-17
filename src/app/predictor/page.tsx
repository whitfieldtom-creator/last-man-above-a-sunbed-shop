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
      <main>
        <p className="eyebrow">Screen 3</p>
        <h2>Score Predictor</h2>
        <p className="text-muted">No game week open right now — check back after the next pull.</p>
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
    <main>
      <p className="eyebrow">Screen 3 · Week {gameWeek.weekNumber}</p>
      <h2>Score Predictor</h2>
      <p className="text-muted">{player.name}</p>
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
