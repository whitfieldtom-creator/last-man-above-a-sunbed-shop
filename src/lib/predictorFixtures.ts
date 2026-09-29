import { prisma } from "@/lib/db";

// If a selected Predictor fixture has since become postponed, swap it for a
// fresh pending fixture from the same game week that isn't already selected.
// Any picks already made against the postponed fixture are cleared — those
// players need to pick again for the replacement. Safe to call any time
// before a week settles; a no-op if nothing's postponed.
export async function replacePostponedPredictorFixtures(gameWeekId: number): Promise<{ replaced: number; picksCleared: number }> {
  const predictorFixtures = await prisma.predictorFixture.findMany({
    where: { gameWeekId },
    include: { fixture: true, predictorPicks: true },
  });
  const postponed = predictorFixtures.filter((pf) => pf.fixture.result === "postponed");
  if (postponed.length === 0) return { replaced: 0, picksCleared: 0 };

  const selectedFixtureIds = new Set(predictorFixtures.map((pf) => pf.fixtureId));
  const candidates = await prisma.fixture.findMany({
    where: { gameWeekId, result: "pending", id: { notIn: [...selectedFixtureIds] } },
  });
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);

  let picksCleared = 0;
  let replaced = 0;
  for (const pf of postponed) {
    const replacement = shuffled.pop();
    if (!replacement) break; // no non-postponed, unselected fixture left this week

    picksCleared += pf.predictorPicks.length;
    await prisma.predictorPick.deleteMany({ where: { predictorFixtureId: pf.id } });
    await prisma.predictorFixture.update({ where: { id: pf.id }, data: { fixtureId: replacement.id } });
    selectedFixtureIds.add(replacement.id);
    replaced++;
  }

  return { replaced, picksCleared };
}
