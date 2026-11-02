import { prisma } from "@/lib/db";
import { BONUS_POINTS_MULTIPLIER } from "@/lib/bonus";

// See last-man-standing-plan.md section 7.
function matchResult(homeScore: number, awayScore: number): "home" | "away" | "draw" {
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

// Points for one pick: 3 for the exact score, 1 for the right result (home
// win / draw / away win), otherwise 0 — doubled for the BIG MONEY BONUS GAME.
export function predictorPoints(
  pick: { predictedHomeScore: number; predictedAwayScore: number },
  actual: { homeScore: number | null; awayScore: number | null },
  isBonus: boolean
): number {
  if (actual.homeScore === null || actual.awayScore === null) return 0;

  let points = 0;
  if (pick.predictedHomeScore === actual.homeScore && pick.predictedAwayScore === actual.awayScore) {
    points = 3;
  } else if (matchResult(pick.predictedHomeScore, pick.predictedAwayScore) === matchResult(actual.homeScore, actual.awayScore)) {
    points = 1;
  }
  return isBonus ? points * BONUS_POINTS_MULTIPLIER : points;
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

  for (const { fixture, predictorPicks, isBonus } of predictorFixtures) {
    for (const pick of predictorPicks) {
      const points = predictorPoints(pick, fixture, isBonus);

      await prisma.predictorPick.update({ where: { id: pick.id }, data: { pointsAwarded: points } });
      scoredCount++;
    }
  }

  return scoredCount;
}
