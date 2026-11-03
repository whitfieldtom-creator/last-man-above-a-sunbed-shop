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
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      // A dropped connection (e.g. ECONNRESET) is transient too.
      if (attempt < maxAttempts) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      throw err;
    }
    if (res.ok) return res.json();

    // Their API has had patches of 5xx errors (seen: 503 on a Tuesday run) —
    // worth waiting out rather than failing the whole weekly job.
    if (res.status >= 500 && attempt < maxAttempts) {
      await sleep(2 ** attempt * 1000);
      continue;
    }

    if (res.status === 429 && attempt < maxAttempts) {
      // The limit is per-minute and the response says how long to wait
      // (Retry-After, seconds) — honour it, with the exponential backoff
      // (2s, 4s, 8s, 16s, 32s) as a floor. Without this the backoff could
      // finish inside the same rate-limit window and every attempt failed.
      const retryAfterMs = Number(res.headers.get("retry-after")) * 1000;
      const backoffMs = 2 ** attempt * 1000;
      await sleep(Math.min(Math.max(backoffMs, Number.isFinite(retryAfterMs) ? retryAfterMs + 1000 : 0), 65_000));
      continue;
    }
    throw new Error(`TheSportsDB request failed: ${res.status} ${res.statusText}`);
  }
  throw new Error("unreachable");
}

// All of a league's fixtures on one calendar date (YYYY-MM-DD, UTC).
//
// This replaced the old eventsnextleague + eventsround approach: eventsround
// isn't served to personal (paid) keys at all (404 "API endpoint not found"),
// and the "next round" pointer it relied on is unreliable anyway — it gets
// stuck on a catch-up round of rescheduled games, so for League One/Two the
// real weekend fixtures were never fetched (week 7, 30 Oct - 2 Nov: 12 + 12
// games existed, the job found none). Asking for each date directly has
// neither problem. See last-man-standing-plan.md section 11.
export async function getEventsOnDay(leagueId: string, date: string): Promise<SportsDbEvent[]> {
  const { events } = await sportsDbGet("eventsday.php", { d: date, l: leagueId });
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
