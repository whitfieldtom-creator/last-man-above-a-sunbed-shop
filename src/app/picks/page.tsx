import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentGameWeek, getCurrentPlayer } from "@/lib/session";
import PicksView, { type PicksViewData } from "./PicksView";

// Everyone's LMS picks and Predictor scorelines for the current game week.
// Hidden until the pick deadline has passed, and — because the current game
// week moves on when Tuesday's job closes this one and pulls the next — it
// goes away again at the start of the following week (the menu button too).
export const dynamic = "force-dynamic";

export default async function EveryonesPicksPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  const gameWeek = await getCurrentGameWeek();
  // Checked on the server so picks can never be seen early by guessing the URL.
  if (!gameWeek || new Date() <= gameWeek.pickDeadline) redirect("/menu");

  const [leagues, players, lives, lmsPicks, predictorFixtures] = await Promise.all([
    prisma.league.findMany({ orderBy: { id: "asc" } }),
    prisma.player.findMany({ orderBy: { id: "asc" } }),
    prisma.playerLeagueLife.findMany({ where: { runId: gameWeek.runId } }),
    prisma.lmsPick.findMany({ where: { gameWeekId: gameWeek.id } }),
    prisma.predictorFixture.findMany({
      where: { gameWeekId: gameWeek.id },
      include: { fixture: true, predictorPicks: true },
      orderBy: { fixture: { kickoffTime: "asc" } },
    }),
  ]);
  const runEntries = await prisma.runEntry.findMany({ where: { runId: gameWeek.runId } });

  const eliminatedIds = new Set(runEntries.filter((e) => e.eliminated).map((e) => e.playerId));
  const aliveKey = new Set(lives.filter((l) => l.alive).map((l) => `${l.playerId}:${l.leagueId}`));
  const pickKey = new Map(lmsPicks.map((p) => [`${p.playerId}:${p.leagueId}`, p.teamPicked]));

  const data: PicksViewData = {
    weekNumber: gameWeek.weekNumber,
    lmsSkipped: gameWeek.lmsSkipped,
    leagues: leagues.map((l) => ({ id: l.id, name: l.name })),
    lmsRows: players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      eliminated: eliminatedIds.has(p.id),
      cells: leagues.map((l) => {
        const team = pickKey.get(`${p.id}:${l.id}`);
        if (team) return { kind: "pick" as const, team };
        return aliveKey.has(`${p.id}:${l.id}`) ? { kind: "none" as const } : { kind: "out" as const };
      }),
    })),
    predictorFixtures: predictorFixtures.map((pf) => ({
      id: pf.id,
      homeTeam: pf.fixture.homeTeam,
      awayTeam: pf.fixture.awayTeam,
      isBonus: pf.isBonus,
      rows: players.map((p) => {
        const pick = pf.predictorPicks.find((x) => x.playerId === p.id);
        return {
          playerId: p.id,
          playerName: p.name,
          pick: pick ? `${pick.predictedHomeScore}–${pick.predictedAwayScore}` : null,
        };
      }),
    })),
  };

  return <PicksView {...data} />;
}
