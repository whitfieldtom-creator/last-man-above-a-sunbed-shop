# Last Man Above A Sunbed Shop + Score Predictor — Project Plan (Draft v18 — build-ready)

Two games, one app, sharing the same weekly fixture pull:
1. **Last Man Standing (LMS)** — each player has one life *per league* (4 lives total: Premier League, Championship, League One, League Two). Pick a winner each week in every league you still have a life in; a wrong/no pick loses that league's life only, not the others. Last player with any life remaining wins overall, then everyone resets across all four leagues.
2. **Score Predictor** — every player predicts the exact score for the same 5 randomly-selected fixtures each week; running points table, ongoing (no reset).

## 1. Weekly cycle

**Game week window redefined: Friday through Monday (inclusive)** — not Friday–Thursday as in earlier drafts. A single scheduled job runs **every Tuesday**, doing both steps together (this combined-job design now works cleanly because the window is short enough not to overlap the next pull — see below):

1. **Settle** the game week that just finished (its window ended **yesterday**, Monday) — pull final results, grade LMS picks (eliminate as needed) and Predictor picks. Use a date check (`window_end` = yesterday, not yet settled) rather than a hardcoded offset, so this self-corrects if a run is ever missed or delayed.
2. **Pull** the next window's fixtures — **next Friday through the Monday after** — across all four English leagues, and randomly select 5 of those fixtures for that week's Score Predictor.

Worked example with real dates:
- Tue 18 Aug: pull GW1 (Fri 21–Mon 24 Aug) — nothing to settle yet, first ever run
- Fri 21 Aug, 12:00: GW1 picks lock
- Games play Fri 21–Mon 24 Aug
- Tue 25 Aug: **settle GW1** (finished Mon 24 Aug) + **pull GW2** (Fri 28–Mon 31 Aug)
- Fri 28 Aug, 12:00: GW2 picks lock
- Tue 1 Sep: settle GW2 + pull GW3 (Fri 4–Mon 7 Sep), and so on

Why this works cleanly now: the window is only 4 days (Fri–Mon), settled the very next day (Tuesday), with a full 3 days of buffer before that same week's Friday-noon deadline for the *next* game week. This avoids the overlap bug the original Fri–Thu design had (where a 6-day window pulled every 7 days meant the next pull landed mid-window, before results existed) — no need for a separate Friday settle job anymore, one Tuesday job handles both steps safely.

**Smaller fixture pool, worth knowing**: the Predictor's "skip the week if fewer than 5 total fixtures" rule (section 2) will likely trigger somewhat more often now, since the pool it draws from is 4 days instead of the old 6 — especially around international breaks.

- **Pick deadline**: midday Friday UK time (fixed cutoff, not tied to individual kickoff times) — covers both LMS and Predictor picks for that window
- Leagues: **Premier League, Championship, League One, League Two**

## 2. Postponed fixtures & thin weeks

- **Postponed/delayed fixture, no score by settlement time**:
  - LMS: if a player's pick in a given league has no result, they lose their life **in that league only** — same as a wrong pick, postponements aren't forgiven. Their lives in other leagues are unaffected.
  - Predictor: that fixture scores 0 points; doesn't affect their other 4 picks
- **Thin weeks (international breaks, cup weeks) — the two games are handled differently**:
  - **LMS**: a player only picks in leagues where they still have a life AND that league has fixtures that week. If a league they still have a life in has no fixtures that week, they simply don't pick in it that week — no penalty, no life lost, it just doesn't come up. **Exception**: if *every* league a player still has a life in has no fixtures that week (all their remaining leagues are simultaneously thin — e.g. a full international break while they're already out of the others), they're eliminated entirely, since there's no possible pick for them to make. Only skip LMS pulling for the week app-wide if *zero* leagues have any fixtures at all.
  - **Predictor**: skip the week only if there are fewer than 5 fixtures in total across all four leagues combined (not enough to fill the 5 random picks).

## 3. App flow

1. **Choose player** — select from the seeded player list (see below); no self-serve signup, no in-app creation screen needed
2. **Branch — "Make picks" or "View leaderboard"**:
   - Button label/behaviour depends on the current game week's `status`:
     - **`open`** (before Friday 12:00 deadline): button reads **"Make picks"** — full editable flow, as below
     - **`locked`** (Friday 12:00 → the following Tuesday's settle+pull job): button reads **"View my picks"** — same screens, but read-only: shows exactly what the player already submitted (their LMS team per league, their Predictor scores), no inputs, no submit action. This gives players visibility into their own picks right up until the fixtures get replaced by the next pull, rather than losing access the moment the deadline passes.
   - **View leaderboard** is always available, regardless of pick-window state.
3. **Last Man Standing pick** *(reached via "Make picks" or "View my picks")* — only shows leagues where the player still has a life remaining; a league the player's already lost their life in disappears from this screen entirely (not just greyed — they're done with it for this run). Within each shown league, one pick required if it has fixtures that week; click a team name to pick them as winner; teams the player has already used *in that league* this run are greyed out and unclickable; clicking "Next" submits all of that week's picks together, then continues to step 4. In read-only mode, the player's own pick(s) are shown highlighted with no other interaction available.
   - Skipped entirely for players with zero lives left in any league — they go straight to step 4 (redirected past the LMS screen rather than shown a disabled version of it; confirmed as the intended behaviour)
4. **Score Predictor** *(reached via "Make picks" or "View my picks", after step 3)* — the same 5 randomly-selected fixtures for every player; enter a predicted score for each; clicking "Next" submits and returns to the branch/leaderboard. In read-only mode, shows the player's already-submitted scores with no inputs. Stays fully playable for eliminated players — no elimination check on this path.
5. **Leaderboard** — reachable directly from step 2, or automatically after finishing picks in steps 3-4. Three panels:
   - LMS: current run status — each player's per-league life status (alive/dead per league, not a single lives count), past run winners
   - Predictor: season-long points table (1 pt correct result, 3 pts exact score — total, not stacked)
   - LMS Points (season): running total of each player's points-pot payouts across every finished run (section 6a)

## 4. Seed data
Players (seeded directly into the DB, no admin UI needed for this):
`Tom, Goods, Kev, Rich, Ed, Gary, Martin`

Each player has a passcode (plaintext distributed by whoever runs the pool, hashed at rest) entered after picking their name on screen 1 — a lightweight gate, not real authentication. See section 8.

## 5. Data model (draft v7)

```
players
  id, name, created_at, passcode_hash (nullable)  -- seeded, seven rows to start

leagues
  id, name                                        -- Premier League, Championship, League One, League Two

runs                                              -- Last Man Standing runs only
  id, run_number, started_at, ended_at
  winners: many-to-many with players               -- usually one, joint on a shared final-week elimination (section 6)

run_entries                                        -- one row per player per run — tracks whether they're FULLY out
  id, run_id, player_id, eliminated, eliminated_at_week_id (nullable),
  lms_points_awarded (nullable)                     -- null until the run ends, then this player's payout (section 6a)
  -- `eliminated` mirrors "all four of this player's player_league_lives rows are alive=false" —
  -- kept as its own column so run-ending/payout logic doesn't need to re-derive it every time.

player_league_lives                               -- one row per player per league per run — the actual per-league life
  id, run_id, player_id, league_id, alive (bool, default true)
  -- a wrong/missing/postponed pick in that league sets alive=false, removing that league
  -- from the player's pick screen for the rest of the run (section 6)

game_weeks
  id, run_id, week_number, window_start (Fri), window_end (Mon),
  pick_deadline (Fri 12:00 UK), status (open | locked | settled | skipped),
  report_sent_at (nullable)                         -- set once the Friday deadline report email goes out (section 6b)

fixtures
  id, game_week_id, league_id, home_team, away_team, kickoff_time,
  result (pending | home | away | draw | postponed), home_score, away_score,
  external_id (API fixture id)

predictor_fixtures
  id, game_week_id, fixture_id                    -- the 5 chosen fixtures for that week, same for everyone

lms_picks
  id, player_id, game_week_id, league_id, fixture_id, team_picked, correct (nullable)
  -- one row per player per league per game week (not one row per player per week)

predictor_picks
  id, player_id, predictor_fixture_id,
  predicted_home_score, predicted_away_score, points_awarded (nullable)
```

Team lock (section 6) is derived live from `lms_picks` history filtered by league — every team a player has picked in a given league this run, regardless of whether that pick survived, is unavailable again in that league. No separate table needed for this (an earlier `used_teams` table existed only on paper and was never actually used by the app — removed).

## 6. Last Man Standing — survival rule (per-league lives)
Each player has **one life per league** (4 total), tracked independently:

- Each week, a player picks a winner in every league they still have a life in (that has fixtures that week — see thin-week handling in section 2)
- A correct pick keeps that league's life; a wrong, missing, or postponed-with-no-result pick **loses that life for that league only**
- Losing a league's life removes that league from the player's pick screen for the rest of the run — they keep playing whichever other leagues they're still alive in
- Different players will naturally end up "active" in different combinations of leagues over time, since eliminations happen independently per league per player
- A player is **fully out of the run** once they've lost all 4 lives (or hit the thin-week exception in section 2)
- **Winning/reset**: the run ends when only one player has any life remaining (in any league); that player is logged as the run's winner, and then **all four leagues reset together** for everyone — every player starts the new run with all 4 lives restored and used-team locks cleared

## 6a. LMS points pot
A separate scoring layer on top of the survival rule above — doesn't change who gets eliminated or how, just adds a points payout once a run finishes.

Each run has its own pot, starting at 4 points and growing by 4 for every game week that passes (settled or skipped — a thin week with no fixtures still adds its 4 points). The pot resets to 0 when a new run starts.

When the run ends, the final pot is split 60% / 25% / 15% among whoever survived longest / 2nd-longest / 3rd-longest. "Survived longest" is ranked by `run_entries.eliminated_at_week_id` — the winner(s) rank highest, then whoever was most recently fully eliminated (all 4 leagues gone), and so on. A player who's lost 3 of their 4 lives but isn't fully out yet still only counts once they're actually fully eliminated — there's no partial credit for how many leagues they'd already lost.

**Ties**: players tied for a rank (i.e. fully eliminated in the same week, or joint run winners) absorb as many consecutive payout tiers as there are people tied, pool those percentages, and split the pooled amount evenly — e.g. two joint winners split 60%+25%=85% between them (42.5% each), and whoever's next takes the remaining 15% as "3rd" (there's no "2nd"). Same logic applies further down: two players tied for 2nd/3rd split 25%+15%=40% between them, while a lone winner still keeps 60% outright.

Players who don't place in the top 3 (or the equivalent tied group) get 0 from this run. Screen 5 shows a season-long "LMS Points" table — a running total of each player's payouts added up across every run that's finished so far, alongside (not replacing) the current run's per-league status panel.

## 6b. Friday deadline report (email)
Once picks lock (Friday 12:00 UK), send a report email showing everyone's picks for that game week — nominally 5 minutes later (12:05 UK), though see the reliability note below on why it isn't always that prompt in practice.

- **Recipient**: hardcoded to `whitfield.tom@gmail.com` for now, via the `REPORT_RECIPIENT_EMAIL` env var — a single config value, not scattered through the code, so it's a one-line change to support multiple recipients later.
- **Sender service**: **Resend**, via a plain HTTP call (`src/lib/email.ts`) — no SDK dependency. Sends from Resend's shared sandbox address (`onboarding@resend.dev`, configurable via `EMAIL_FROM`) unless a verified custom domain is set up later.
- **Content/format**: HTML tables (`src/lib/report.ts`) — renders properly in the email client, and pastes into Excel/Sheets/Word as columns when copied. Minimal styling: borders and a header row only, no colours/branding. Two separate tables:
  - **Last Man Standing**: fixed column order — Player, Premier League, Championship, League One, League Two — one row per player, showing their picked team per league (blank/dash if that league had no fixtures that week, if the player didn't submit, or if they'd already lost that league's life)
  - **Score Predictor**: Player, then one column per that week's 5 fixtures, one row per player, showing their predicted score
- **Timezone handling (built)**: rather than re-deriving UK local time at send time, this leans on `pickDeadline` already being computed DST-safely when the game week is created (`ukNoonUtc()` in `weeklyJob.ts`, which asks `Intl.DateTimeFormat` for the actual `Europe/London` wall-clock hour). `.github/workflows/friday-report.yml` fires the job at both `12:05 UTC` (GMT) and `11:05 UTC` (BST), so one of the two always lines up with the real deadline.
- **Reliability (built, revised after two live failures)**: the `/api/cron/friday-report` endpoint originally only matched a game week whose `pickDeadline` fell within a recent window (20 minutes, then widened to 50). Both attempts failed in practice — live runs showed GitHub Actions firing this workflow anywhere from ~30 minutes to ~10 hours late, and some weeks not firing at all until hours after the deadline. Rather than chase an ever-larger window (risky past ~60 minutes, since that's the gap to the *other* DST trigger — too wide risks matching the wrong week), the endpoint now has **no time window at all**: it just finds the most recent game week whose deadline has passed and whose report hasn't been sent (`reportSentAt IS NULL`), with no upper bound on lateness. `reportSentAt` (section 5) is what makes this safe — first call to find an unreported due week sends it and marks it sent; every subsequent call that day is a no-op. The workflow fires six times spread across Friday afternoon/evening (11:05, 12:05, 14:05, 17:05, 20:05, 23:05 UTC) purely to give a dropped or badly-delayed morning trigger more chances to be caught the same day — each is safe to fire regardless of whether an earlier one already succeeded.

## 7. Scoring — Score Predictor
- 1 point: correct result (home win / away win / draw) but wrong scoreline
- 3 points: exact scoreline (total — not stacked on top of the 1)
- 0 points: postponed fixture with no result
- Running total across all game weeks, no reset (separate from LMS run resets)

## 8. Admin & player passcodes
No admin UI in the app at all — settlement, result overrides, and any manual week-skipping are managed directly on the backend/database, not through the site.

Players get a passcode after choosing their name on screen 1, so one player can't casually submit picks as another — but it's a lightweight gate, not real authentication (no signup, no password reset, no rate limiting beyond what's built in). Passcodes are set via the seed script (plaintext values live only in a local, gitignored env var, hashed with scrypt before being written to the DB) and distributed by whoever's running the pool. Fine for a group of friends; flagged here in case a future version wants proper auth instead.

## 9. Predictor season boundary
The Predictor table runs continuously through the whole season, including play-offs, and resets only once all league fixtures (play-offs included) are finished — ready for the next season to start fresh.

## 10. Stack (built and deployed)
- Frontend + backend: **Next.js (App Router)** — one deployable service, no separate React/Express split
- DB: **Postgres**, provisioned as a Railway plugin (not Supabase/Neon/SQLite)
- Fixture data: **TheSportsDB v1 API** (free tier — switched from API-Football, whose free plan doesn't cover the current season)
- Email: **Resend** free tier, plain HTTP call (section 6b)
- Scheduler: GitHub Actions weekly cron (**Tuesday**, see section 1, plus **Friday** for the deadline report, section 6b) hitting backend endpoints
- Hosting: **Railway** (hobby plan, ~$5/mo) — always-on, no sleep/cold-start, deploy via git push

## 11. Fixture data — TheSportsDB v1 integration detail (verified against the live API)
Sticking with **v1** (free) rather than v2 (Premium-only, ~€9/month) — verified working for all four leagues, no need to pay.

**Auth**: the free tier has no personal key — everyone free uses the same shared key `123`. Our actual call volume (~12 requests once a week) is tiny next to the 30 requests/minute free rate limit — but the shared key's *reliability* isn't ours to control, and has caused three separate live incidents (a stale round pointer returning nothing for an overdue settlement, 429 exhaustion aborting a pull mid-week, and a silent empty response for one league that resolved fine moments later). Client-side retries/pacing/idempotent-skip mitigate each as it's found, but don't fix the underlying shared-resource unreliability.

**Backlog**: a personal TheSportsDB API key (Patreon-supporter tier, ~€3-9/month) would give a dedicated rate limit and likely eliminate this whole class of issue. Deferred for now — current mitigations are good enough to catch and manually recover from failures when they happen, and our volume is low enough that it isn't urgent. Revisit if these incidents keep recurring or become too disruptive to manually patch around.

**League IDs** (confirmed working, verified live for all four):
- Premier League: `4328`
- Championship: `4329`
- League One: `4396`
- League Two: `4397`

**Endpoints tried, and what actually works:**
- `eventsnextleague.php?id={leagueId}` — only returns the single next unplayed fixture, not "~15 upcoming" as first assumed. Not usable as the main pull source, but useful for discovering the current round number (`intRound`).
- `eventsseason.php?id={leagueId}&s={season}` — hard-capped at exactly 15 events total per league regardless of params (confirmed identical across all 4 leagues). Works by coincidence in week 1 of a season, silently useless later. **Do not use.**
- `eventsround.php?id={leagueId}&r={round}&s={season}` — **the correct endpoint.** Returns the full round (10 fixtures for the 20-team Premier League, 12 for the 24-team Championship/League One/Two), for both future (unplayed, `strStatus: "NS"`) and past (finished, `strStatus: "FT"`, scores populated) rounds.

**Pull job (Tuesday)** — for each of the 4 leagues:
1. `eventsnextleague.php?id={leagueId}` → read `intRound` (call it `R`) from the single event returned.
2. Fetch **both** `eventsround.php?id={leagueId}&r={R}&s={season}` and `r={R+1}`, and merge. Round `R` alone isn't reliable — verified live that a round can be mostly in the past with only one delayed/rearranged fixture left "next" (this happened for the Championship: `R` was mostly Aug 14–17 fixtures, the actual target-window round was `R+1`). Fetching both and filtering by date is what makes this robust; `R+1` costs one harmless extra request when `R` already covers the whole window.
3. Filter the merged list to fixtures with `dateEvent` inside the Fri–Mon window (now 4 days, not 7 — see section 1; expect a smaller per-week fixture count than the original Fri–Thu design, not yet re-verified against a live pull for this exact window shape).
4. Store each fixture's `idEvent` (as `external_id`, needed for settlement), `strHomeTeam`, `strAwayTeam`, `strTimestamp` (UTC kickoff time).

**Settlement job (Tuesday, before pulling new fixtures)** — re-run the *same* `eventsround.php` call(s) used to pull that game week (no separate per-fixture lookup needed — confirmed `eventsround.php` returns updated `intHomeScore`/`intAwayScore` and `strStatus: "FT"` once matches finish, from the same request shape used to pull). Match returned events back to stored fixtures by `idEvent`. A fixture still `"NS"` (or a postponed/cancelled status) at settlement time = no result per the rules in section 2.

**Season string**: TheSportsDB wants `"2026-2027"` format — the year football's August kickoff falls in, and the year after.
