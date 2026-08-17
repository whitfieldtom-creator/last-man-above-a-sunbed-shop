import { prisma } from "@/lib/db";

// See last-man-standing-plan.md section 6.
export const STARTING_LIVES = 4;

function isPickCorrect(
  teamPicked: string,
  fixture: { result: string; homeTeam: string; awayTeam: string }
): boolean {
  if (fixture.result === "home") return teamPicked === fixture.homeTeam;
  if (fixture.result === "away") return teamPicked === fixture.awayTeam;
  // draw, postponed, or still pending at settlement time all count as wrong
  return false;
}

// Settles one game week: scores each LMS pick against its fixture result,
// applies the lives rule (each wrong/missing pick costs a life, a wrong
// pick while already at 0 lives eliminates), and closes out the run if
// it's down to one survivor or everyone still in it goes out together.
export async function settleLmsGameWeek(gameWeekId: number) {
  const gameWeek = await prisma.gameWeek.findUniqueOrThrow({
    where: { id: gameWeekId },
    include: {
      fixtures: true,
      lmsPicks: { include: { fixture: true } },
    },
  });

  const leagueIdsThisWeek = [...new Set(gameWeek.fixtures.map((f) => f.leagueId))];

  const picksByPlayer = new Map<number, typeof gameWeek.lmsPicks>();
  for (const pick of gameWeek.lmsPicks) {
    const list = picksByPlayer.get(pick.playerId) ?? [];
    list.push(pick);
    picksByPlayer.set(pick.playerId, list);
  }

  for (const pick of gameWeek.lmsPicks) {
    const correct = isPickCorrect(pick.teamPicked, pick.fixture);
    if (pick.correct !== correct) {
      await prisma.lmsPick.update({ where: { id: pick.id }, data: { correct } });
    }
  }

  const activeEntries = await prisma.runEntry.findMany({
    where: { runId: gameWeek.runId, eliminated: false },
  });

  const eliminatedThisWeek: number[] = [];

  for (const entry of activeEntries) {
    const picks = picksByPlayer.get(entry.playerId) ?? [];
    const pickedLeagueIds = new Set(picks.map((p) => p.leagueId));
    const missingPicks = leagueIdsThisWeek.filter((id) => !pickedLeagueIds.has(id)).length;
    const wrongPicks = picks.filter((p) => !isPickCorrect(p.teamPicked, p.fixture)).length;
    const totalMisses = missingPicks + wrongPicks;

    let lives = entry.livesRemaining;
    let eliminated = false;
    for (let i = 0; i < totalMisses; i++) {
      if (lives === 0) {
        eliminated = true;
        break;
      }
      lives -= 1;
    }

    await prisma.runEntry.update({
      where: { id: entry.id },
      data: {
        livesRemaining: lives,
        eliminated,
        eliminatedAtWeekId: eliminated ? gameWeek.id : null,
      },
    });

    if (eliminated) eliminatedThisWeek.push(entry.playerId);
  }

  await prisma.gameWeek.update({ where: { id: gameWeek.id }, data: { status: "settled" } });

  const stillActiveCount = await prisma.runEntry.count({
    where: { runId: gameWeek.runId, eliminated: false },
  });

  if (stillActiveCount === 0 && eliminatedThisWeek.length > 0) {
    // Everyone who was still in it went out the same week — joint winners.
    await prisma.run.update({
      where: { id: gameWeek.runId },
      data: {
        endedAt: new Date(),
        winners: { connect: eliminatedThisWeek.map((id) => ({ id })) },
      },
    });
  } else if (stillActiveCount === 1) {
    const [survivor] = await prisma.runEntry.findMany({
      where: { runId: gameWeek.runId, eliminated: false },
      select: { playerId: true },
    });
    await prisma.run.update({
      where: { id: gameWeek.runId },
      data: {
        endedAt: new Date(),
        winners: { connect: [{ id: survivor.playerId }] },
      },
    });
  }
}
