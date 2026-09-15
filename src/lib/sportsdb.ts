// TheSportsDB v1 client. See last-man-standing-plan.md section 11 for how
// this was verified against the live API — eventsround.php is the only
// reliable source of a full round's fixtures; eventsnextleague.php is only
// used to discover the current round number.

const SPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json";

function sportsDbKey(): string {
  return process.env.SPORTSDB_API_KEY || "123";
}

export type SportsDbEvent = {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  dateEvent: string;
  strTimestamp: string;
  strStatus: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  intRound: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The free tier's key (`123`) is shared with every other free user, so
// occasional 429s from someone else's traffic are expected — retry with
// backoff rather than failing the whole weekly job over a transient limit.
async function sportsDbGet(path: string, params: Record<string, string>): Promise<{ events: SportsDbEvent[] | null }> {
  const url = new URL(`${SPORTSDB_BASE}/${sportsDbKey()}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();

    if (res.status === 429 && attempt < maxAttempts) {
      await sleep(2 ** attempt * 1000); // 2s, 4s, 8s, 16s, 32s
      continue;
    }
    throw new Error(`TheSportsDB request failed: ${res.status} ${res.statusText}`);
  }
  throw new Error("unreachable");
}

// The single next unplayed fixture for a league, used only to read its
// round number — not reliable as a source of fixture lists (see section 11).
//
// An empty response here is treated by the caller as "this league has no
// fixtures this week" (a legitimate thin week, see section 2) — but a live
// run showed the API can also return a 200 with an empty events list as a
// transient blip for a league that, moments later, has data again. That's
// indistinguishable from a real thin week unless we double-check, so retry
// a couple of times on an empty result before accepting it.
export async function getNextRound(leagueId: string): Promise<number | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { events } = await sportsDbGet("eventsnextleague.php", { id: leagueId });
    const round = events?.[0]?.intRound;
    if (round) return Number(round);
    if (attempt < 3) await sleep(3000);
  }
  return null;
}

export async function getRoundFixtures(leagueId: string, round: number, season: string): Promise<SportsDbEvent[]> {
  const { events } = await sportsDbGet("eventsround.php", { id: leagueId, r: String(round), s: season });
  return events ?? [];
}

// Looks up a single stored fixture by its external event id — used to
// refresh results at settlement time. Unlike eventsround.php, this doesn't
// depend on the league's "next round" pointer still covering the target
// week, so it stays reliable even if settlement runs later than expected
// (see the incident this was added for: a stale windowEnd meant a week
// wasn't settled until several rounds after it actually finished, by which
// point re-fetching "the next round" no longer returned its fixtures at all).
export async function lookupEvent(idEvent: string): Promise<SportsDbEvent | null> {
  const data = await sportsDbGet("lookupevent.php", { id: idEvent });
  const events = (data as { events?: SportsDbEvent[] | null; event?: SportsDbEvent[] | null }).events ?? (data as { event?: SportsDbEvent[] | null }).event;
  return events?.[0] ?? null;
}
