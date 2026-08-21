import { prisma } from "@/lib/db";

// Builds the Friday-deadline report email body — see last-man-standing-plan.md
// section 6a. Plain text, tab-separated, so it pastes cleanly into a
// spreadsheet. Returns null if there's nothing to report (week got skipped
// before any picks screens existed for it).
export async function buildFridayReportEmail(gameWeekId: number) {
  const gameWeek = await prisma.gameWeek.findUniqueOrThrow({
    where: { id: gameWeekId },
    include: {
      fixtures: { include: { league: true }, orderBy: [{ league: { name: "asc" } }, { kickoffTime: "asc" } ] },
      predictorFixtures: { include: { fixture: true }, orderBy: { fixture: { kickoffTime: "asc" } } },
    },
  });

  const leagues = [...new Map(gameWeek.fixtures.map((f) => [f.league.id, f.league])).values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  if (leagues.length === 0 && gameWeek.predictorFixtures.length === 0) return null;

  const players = await prisma.player.findMany({ orderBy: { id: "asc" } });

  const lmsPicks = await prisma.lmsPick.findMany({ where: { gameWeekId } });
  const lmsPickByPlayerAndLeague = new Map(lmsPicks.map((p) => [`${p.playerId}:${p.leagueId}`, p.teamPicked]));

  const predictorPicks = await prisma.predictorPick.findMany({
    where: { predictorFixtureId: { in: gameWeek.predictorFixtures.map((pf) => pf.id) } },
  });
  const predictorPickByPlayerAndFixture = new Map(
    predictorPicks.map((p) => [`${p.playerId}:${p.predictorFixtureId}`, `${p.predictedHomeScore}-${p.predictedAwayScore}`])
  );

  const lmsHeader = ["Player", ...leagues.map((l) => l.name)].join("\t");
  const lmsRows = players.map((player) =>
    [player.name, ...leagues.map((l) => lmsPickByPlayerAndLeague.get(`${player.id}:${l.id}`) ?? "")].join("\t")
  );

  const predictorColumns = gameWeek.predictorFixtures.map((pf) => `${pf.fixture.homeTeam} v ${pf.fixture.awayTeam}`);
  const predictorHeader = ["Player", ...predictorColumns].join("\t");
  const predictorRows = players.map((player) =>
    [
      player.name,
      ...gameWeek.predictorFixtures.map((pf) => predictorPickByPlayerAndFixture.get(`${player.id}:${pf.id}`) ?? ""),
    ].join("\t")
  );

  const text = [
    `Week ${gameWeek.weekNumber} picks — deadline just passed`,
    "",
    "LAST MAN STANDING",
    lmsHeader,
    ...lmsRows,
    "",
    "SCORE PREDICTOR",
    predictorHeader,
    ...predictorRows,
  ].join("\n");

  return { subject: `Week ${gameWeek.weekNumber} picks report`, text };
}
