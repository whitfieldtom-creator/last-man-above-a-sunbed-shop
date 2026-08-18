import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentGameWeek, getCurrentPlayer } from "@/lib/session";
import LmsPickForm from "./LmsPickForm";

// Screen 3: Last Man Standing pick — one pick per league with fixtures this week.
// See last-man-standing-plan.md section 3.
export const dynamic = "force-dynamic";

export default async function LmsPickPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  const gameWeek = await getCurrentGameWeek();
  if (!gameWeek) {
    return (
      <main>
        <p className="eyebrow">Screen 3</p>
        <h2>Last Man Standing</h2>
        <p className="text-muted">No game week open right now — check back after the next pull.</p>
        <Link href="/menu" className="link-btn">
          ← Back to menu
        </Link>
      </main>
    );
  }

  const runEntry = await prisma.runEntry.findUnique({
    where: { runId_playerId: { runId: gameWeek.runId, playerId: player.id } },
  });
  if (!runEntry || runEntry.eliminated) redirect("/predictor");

  const fixtures = await prisma.fixture.findMany({
    where: { gameWeekId: gameWeek.id },
    include: { league: true },
    orderBy: [{ league: { name: "asc" } }, { kickoffTime: "asc" }],
  });

  const leagueGroups = new Map<
    number,
    { leagueId: number; leagueName: string; fixtures: { id: number; homeTeam: string; awayTeam: string; kickoffTime: string }[] }
  >();
  for (const fixture of fixtures) {
    if (!leagueGroups.has(fixture.leagueId)) {
      leagueGroups.set(fixture.leagueId, { leagueId: fixture.leagueId, leagueName: fixture.league.name, fixtures: [] });
    }
    leagueGroups.get(fixture.leagueId)!.fixtures.push({
      id: fixture.id,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      kickoffTime: fixture.kickoffTime.toISOString(),
    });
  }

  const existingPicksRows = await prisma.lmsPick.findMany({ where: { playerId: player.id, gameWeekId: gameWeek.id } });
  const existingPicks = Object.fromEntries(
    existingPicksRows.map((p) => [p.leagueId, { fixtureId: p.fixtureId, teamPicked: p.teamPicked }])
  );

  const pastPicks = await prisma.lmsPick.findMany({
    where: { playerId: player.id, gameWeek: { runId: gameWeek.runId }, NOT: { gameWeekId: gameWeek.id } },
    select: { teamPicked: true },
  });
  const usedTeams = pastPicks.map((p) => p.teamPicked);

  return (
    <main>
      <p className="eyebrow">Screen 3 · Week {gameWeek.weekNumber}</p>
      <h2>Last Man Standing</h2>
      <p className="row">
        <span>{player.name}</span>
        <span className="chip chip--alive">
          {runEntry.livesRemaining} {runEntry.livesRemaining === 1 ? "life" : "lives"}
        </span>
      </p>
      <LmsPickForm
        leagueGroups={[...leagueGroups.values()]}
        existingPicks={existingPicks}
        usedTeams={usedTeams}
        deadlineIso={gameWeek.pickDeadline.toISOString()}
      />
      <p style={{ marginTop: "1rem" }}>
        <Link href="/menu" className="link-btn">
          ← Back to menu
        </Link>
      </p>
    </main>
  );
}
