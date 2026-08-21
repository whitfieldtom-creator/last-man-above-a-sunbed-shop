import { prisma } from "@/lib/db";

// Builds the Friday-deadline report email body — see last-man-standing-plan.md
// section 6b. HTML tables: renders properly in the email client, and an HTML
// table pastes into Excel/Sheets/Word as columns when copied, same as the
// tab-separated text this replaced. Returns null if there's nothing to
// report (week got skipped before any picks screens existed for it).

const TABLE_STYLE = "border-collapse: collapse;";
const CELL_STYLE = "border: 1px solid #999; padding: 4px 10px; text-align: left;";
const BLANK = "&ndash;";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildTable(columns: string[], rows: string[][]): string {
  const headerCells = columns.map((c) => `<th style="${CELL_STYLE}">${escapeHtml(c)}</th>`).join("");
  const bodyRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td style="${CELL_STYLE}">${cell || BLANK}</td>`).join("")}</tr>`)
    .join("");
  return `<table style="${TABLE_STYLE}"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

export async function buildFridayReportEmail(gameWeekId: number) {
  const gameWeek = await prisma.gameWeek.findUniqueOrThrow({
    where: { id: gameWeekId },
    include: {
      predictorFixtures: { include: { fixture: true }, orderBy: { fixture: { kickoffTime: "asc" } } },
    },
  });

  const fixtureCount = await prisma.fixture.count({ where: { gameWeekId } });
  if (fixtureCount === 0 && gameWeek.predictorFixtures.length === 0) return null;

  // Fixed column order regardless of which leagues had fixtures this week —
  // seeded in this exact order (see prisma/seed.ts), so ordering by id gives
  // Premier League, Championship, League One, League Two every time.
  const leagues = await prisma.league.findMany({ orderBy: { id: "asc" } });
  const players = await prisma.player.findMany({ orderBy: { id: "asc" } });

  const lmsPicks = await prisma.lmsPick.findMany({ where: { gameWeekId } });
  const lmsPickByPlayerAndLeague = new Map(lmsPicks.map((p) => [`${p.playerId}:${p.leagueId}`, p.teamPicked]));

  const predictorPicks = await prisma.predictorPick.findMany({
    where: { predictorFixtureId: { in: gameWeek.predictorFixtures.map((pf) => pf.id) } },
  });
  const predictorPickByPlayerAndFixture = new Map(
    predictorPicks.map((p) => [`${p.playerId}:${p.predictorFixtureId}`, `${p.predictedHomeScore}-${p.predictedAwayScore}`])
  );

  const lmsTable = buildTable(
    ["Player", ...leagues.map((l) => l.name)],
    players.map((player) => [
      escapeHtml(player.name),
      ...leagues.map((l) => escapeHtml(lmsPickByPlayerAndLeague.get(`${player.id}:${l.id}`) ?? "")),
    ])
  );

  const predictorTable = buildTable(
    ["Player", ...gameWeek.predictorFixtures.map((pf) => `${pf.fixture.homeTeam} v ${pf.fixture.awayTeam}`)],
    players.map((player) => [
      escapeHtml(player.name),
      ...gameWeek.predictorFixtures.map((pf) => predictorPickByPlayerAndFixture.get(`${player.id}:${pf.id}`) ?? ""),
    ])
  );

  const html = [
    `<h2>Week ${gameWeek.weekNumber} picks — deadline just passed</h2>`,
    "<h3>Last Man Standing</h3>",
    lmsTable,
    "<h3>Score Predictor</h3>",
    predictorTable,
  ].join("\n");

  return { subject: `Week ${gameWeek.weekNumber} picks report`, html };
}
