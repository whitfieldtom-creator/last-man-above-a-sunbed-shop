// The weekly "BIG MONEY BONUS GAME" for the Score Predictor: each week one
// fixture involving one of these teams is picked as one of the five
// Predictor games, and is worth double points. Names match what TheSportsDB
// gives us (checked against the stored fixtures).
export const BONUS_TEAMS = [
  "Sunderland",
  "Stockport County",
  "Stoke City",
  "Nottingham Forest",
  "Derby County",
  "Mansfield Town",
] as const;

export const BONUS_POINTS_MULTIPLIER = 2;

export function isBonusTeamFixture(fixture: { homeTeam: string; awayTeam: string }): boolean {
  const teams: readonly string[] = BONUS_TEAMS;
  return teams.includes(fixture.homeTeam) || teams.includes(fixture.awayTeam);
}

// Easter egg: anyone backing Derby to win gets a gentle check-in.
export const DERBY = "Derby County";

// True if this predicted scoreline has Derby winning.
export function predictsDerbyWin(fixture: { homeTeam: string; awayTeam: string }, home: number, away: number): boolean {
  if (fixture.homeTeam === DERBY) return home > away;
  if (fixture.awayTeam === DERBY) return away > home;
  return false;
}
