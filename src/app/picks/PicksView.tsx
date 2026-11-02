import Link from "next/link";
import BonusBanner from "../BonusBanner";

const LEAGUE_ABBREVIATIONS: Record<string, string> = {
  "Premier League": "PL",
  Championship: "CH",
  "League One": "L1",
  "League Two": "L2",
};

export type PicksViewLmsCell = { kind: "pick"; team: string } | { kind: "out" } | { kind: "none" };

export type PicksViewData = {
  weekNumber: number;
  lmsSkipped: boolean;
  leagues: { id: number; name: string }[];
  lmsRows: { playerId: number; playerName: string; eliminated: boolean; cells: PicksViewLmsCell[] }[];
  predictorFixtures: {
    id: number;
    homeTeam: string;
    awayTeam: string;
    isBonus: boolean;
    rows: { playerId: number; playerName: string; pick: string | null }[];
  }[];
};

// What everyone picked this week — only ever rendered once the Friday
// deadline has passed (see page.tsx), so it never leaks picks early.
export default function PicksView({ weekNumber, lmsSkipped, leagues, lmsRows, predictorFixtures }: PicksViewData) {
  return (
    <main>
      <p className="eyebrow">Week {weekNumber}</p>
      <h2>Everyone&apos;s picks</h2>
      <p className="text-muted">Picks are locked — here&apos;s what everyone went for.</p>

      <section>
        <p className="eyebrow" style={{ marginTop: "1.25rem" }}>
          Last Man Standing
        </p>
        {lmsSkipped ? (
          <p className="panel text-muted">
            LMS is skipped this week — a league someone still has a life in has no games. Nobody loses a life.
          </p>
        ) : (
          <div className="panel">
            <div className="results-table-wrap">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    {leagues.map((league) => (
                      <th key={league.id} title={league.name}>
                        {LEAGUE_ABBREVIATIONS[league.name] ?? league.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lmsRows.map((row) => (
                    <tr key={row.playerId}>
                      <td className={row.eliminated ? "text-muted" : undefined}>{row.playerName}</td>
                      {row.cells.map((cell, i) => (
                        <td
                          key={leagues[i].id}
                          className={
                            cell.kind === "out"
                              ? "results-table__status--out"
                              : cell.kind === "none"
                                ? "results-table__status--none"
                                : undefined
                          }
                        >
                          {cell.kind === "pick" ? cell.team : cell.kind === "out" ? "Out" : "No pick"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <p className="eyebrow" style={{ marginTop: "1.5rem" }}>
          Score Predictor
        </p>
        {predictorFixtures.length === 0 && <p className="panel text-muted">No Predictor fixtures this week.</p>}
        <div className="stack">
          {predictorFixtures.map((fixture) => (
            <div key={fixture.id} className={fixture.isBonus ? "panel bonus-block" : "panel"}>
              {fixture.isBonus && <BonusBanner />}
              <p style={{ margin: "0 0 0.4rem", fontWeight: 600, textAlign: fixture.isBonus ? "center" : "left" }}>
                {fixture.homeTeam} v {fixture.awayTeam}
              </p>
              <ul className="pick-list">
                {fixture.rows.map((row) => (
                  <li key={row.playerId}>
                    <span>{row.playerName}</span>
                    <span className={row.pick ? undefined : "text-faint"}>{row.pick ?? "No pick"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p style={{ marginTop: "1.25rem" }}>
        <Link href="/menu" className="link-btn">
          ← Back to menu
        </Link>
      </p>
    </main>
  );
}
