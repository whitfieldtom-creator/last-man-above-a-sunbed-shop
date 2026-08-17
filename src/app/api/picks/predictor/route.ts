import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentGameWeek, getPlayerIdFromRequest } from "@/lib/session";

type PickInput = { predictorFixtureId: number; homeScore: number; awayScore: number };

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export async function POST(request: NextRequest) {
  const playerId = getPlayerIdFromRequest(request);
  if (!playerId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const picks: PickInput[] = Array.isArray(body?.picks) ? body.picks : [];
  if (picks.length === 0) return NextResponse.json({ error: "No picks submitted" }, { status: 400 });

  const gameWeek = await getCurrentGameWeek();
  if (!gameWeek) return NextResponse.json({ error: "No game week open for picks" }, { status: 400 });

  if (new Date() > gameWeek.pickDeadline) {
    return NextResponse.json({ error: "Pick deadline has passed" }, { status: 403 });
  }

  const predictorFixtures = await prisma.predictorFixture.findMany({ where: { gameWeekId: gameWeek.id } });
  const validIds = new Set(predictorFixtures.map((pf) => pf.id));

  for (const pick of picks) {
    if (!validIds.has(pick.predictorFixtureId)) {
      return NextResponse.json({ error: "Not one of this week's Predictor fixtures" }, { status: 400 });
    }
    if (!isNonNegativeInt(pick.homeScore) || !isNonNegativeInt(pick.awayScore)) {
      return NextResponse.json({ error: "Scores must be whole numbers 0 or higher" }, { status: 400 });
    }
  }

  for (const pick of picks) {
    await prisma.predictorPick.upsert({
      where: { playerId_predictorFixtureId: { playerId, predictorFixtureId: pick.predictorFixtureId } },
      update: { predictedHomeScore: pick.homeScore, predictedAwayScore: pick.awayScore, pointsAwarded: null },
      create: {
        playerId,
        predictorFixtureId: pick.predictorFixtureId,
        predictedHomeScore: pick.homeScore,
        predictedAwayScore: pick.awayScore,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
