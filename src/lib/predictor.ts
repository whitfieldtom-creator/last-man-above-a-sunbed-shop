import { prisma } from "@/lib/db";

// See last-man-standing-plan.md section 7.
function matchResult(homeScore: number, awayScore: number): "home" | "away" | "draw" {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

// Scores every Predictor pick for a game week's fixtures against their
// actual results. Safe to call on a week with no Predictor picks (no-op)
// and safe to re-run (recomputes pointsAwarded rather than accumulating).
export async function settlePredictorGameWeek(gameWeekId: number): Promise<number> {
  const predictorFixtures = await prisma.predictorFixture.findMany({
    where: { gameWeekId },
    include: { fixture: true, predictorPicks: true },
  });

  let scoredCount = 0;

  for (const { fixture, predictorPicks } of predictorFixtures) {
    const { homeScore, awayScore } = fixture;

    for (const pick of predictorPicks) {
      let points: number;

      if (homeScore === null || awayScore === null) {
        points = 0;
      } else if (pick.predictedHomeScore === homeScore && pick.predictedAwayScore === awayScore) {
        points = 3;
      } else if (matchResult(pick.predictedHomeScore, pick.predictedAwayScore) === matchResult(homeScore, awayScore)) {
        points = 1;
      } else {
        points = 0;
      }

      await prisma.predictorPick.update({ where: { id: pick.id }, data: { pointsAwarded: points } });
      scoredCount++;
    }
  }

  return scoredCount;
}
