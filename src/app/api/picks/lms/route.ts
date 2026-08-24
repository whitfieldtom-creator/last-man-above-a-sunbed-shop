import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentGameWeek, getPlayerIdFromRequest } from "@/lib/session";

type PickInput = { fixtureId: number; teamPicked: string };

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

  const runEntry = await prisma.runEntry.findUnique({
    where: { runId_playerId: { runId: gameWeek.runId, playerId } },
  });
  if (!runEntry) return NextResponse.json({ error: "Not in the current run" }, { status: 403 });
  if (runEntry.eliminated) return NextResponse.json({ error: "Already eliminated" }, { status: 403 });

  const aliveLeagueIds = new Set(
    (await prisma.playerLeagueLife.findMany({ where: { runId: gameWeek.runId, playerId, alive: true } })).map(
      (l) => l.leagueId
    )
  );

  const fixtureIds = picks.map((p) => p.fixtureId);
  const fixtures = await prisma.fixture.findMany({
    where: { id: { in: fixtureIds }, gameWeekId: gameWeek.id },
  });
  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));

  // Team lock is per league (section 6) — used in one league doesn't block reuse in another.
  const usedTeamPicks = await prisma.lmsPick.findMany({
    where: { playerId, gameWeek: { runId: gameWeek.runId }, NOT: { gameWeekId: gameWeek.id } },
    select: { leagueId: true, teamPicked: true },
  });
  const usedTeamsByLeague = new Map<number, Set<string>>();
  for (const p of usedTeamPicks) {
    if (!usedTeamsByLeague.has(p.leagueId)) usedTeamsByLeague.set(p.leagueId, new Set());
    usedTeamsByLeague.get(p.leagueId)!.add(p.teamPicked);
  }

  const seenLeagueIds = new Set<number>();

  for (const pick of picks) {
    const fixture = fixtureById.get(pick.fixtureId);
    if (!fixture) {
      return NextResponse.json({ error: `Fixture ${pick.fixtureId} not in this game week` }, { status: 400 });
    }
    if (!aliveLeagueIds.has(fixture.leagueId)) {
      return NextResponse.json({ error: "You've already lost your life in that league" }, { status: 403 });
    }
    if (pick.teamPicked !== fixture.homeTeam && pick.teamPicked !== fixture.awayTeam) {
      return NextResponse.json({ error: `${pick.teamPicked} isn't playing in that fixture` }, { status: 400 });
    }
    if (usedTeamsByLeague.get(fixture.leagueId)?.has(pick.teamPicked)) {
      return NextResponse.json({ error: `${pick.teamPicked} has already been used in that league this run` }, { status: 400 });
    }
    if (seenLeagueIds.has(fixture.leagueId)) {
      return NextResponse.json({ error: "Only one pick allowed per league" }, { status: 400 });
    }
    seenLeagueIds.add(fixture.leagueId);
  }

  for (const pick of picks) {
    const fixture = fixtureById.get(pick.fixtureId)!;
    await prisma.lmsPick.upsert({
      where: { playerId_gameWeekId_leagueId: { playerId, gameWeekId: gameWeek.id, leagueId: fixture.leagueId } },
      update: { fixtureId: fixture.id, teamPicked: pick.teamPicked, correct: null },
      create: {
        playerId,
        gameWeekId: gameWeek.id,
        leagueId: fixture.leagueId,
        fixtureId: fixture.id,
        teamPicked: pick.teamPicked,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
