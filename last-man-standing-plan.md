# Last Man Above A Sunbed Shop + Score Predictor — Project Plan (Draft v17 — build-ready)

Two games, one app, sharing the same weekly fixture pull:
1. **Last Man Standing (LMS)** — pick one team to win each week; wrong/no pick eliminates you; last one standing wins, then it resets.
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
  - LMS: costs a life the same as a wrong pick (see section 6) — postponements aren't forgiven
  - Predictor: that fixture scores 0 points; doesn't affect their other 4 picks
- **Thin weeks (international breaks, cup weeks) — the two games are handled differently**:
  - **LMS**: doesn't need all four leagues. Use whichever leagues have fixtures that window — e.g. if only League One and League Two are playing, the LMS pick screen just shows those two leagues. Only skip LMS for the week if *zero* leagues have any fixtures at all.
  - **Predictor**: skip the week only if there are fewer than 5 fixtures in total across all four leagues combined (not enough to fill the 5 random picks).

## 3. App flow

1. **Choose player** — select from the seeded player list (see below); no self-serve signup, no in-app creation screen needed
2. **Branch — "Make picks" or "View leaderboard"**:
   - Button label/behaviour depends on the current game week's `status`:
     - **`open`** (before Friday 12:00 deadline): button reads **"Make picks"** — full editable flow, as below
     - **`locked`** (Friday 12:00 → the following Tuesday's settle+pull job): button reads **"View my picks"** — same screens, but read-only: shows exactly what the player already submitted (their LMS team per league, their Predictor scores), no inputs, no submit action. This gives players visibility into their own picks right up until the fixtures get replaced by the next pull, rather than losing access the moment the deadline passes.
   - **View leaderboard** is always available, regardless of pick-window state.
3. **Last Man Standing pick** *(reached via "Make picks" or "View my picks")* — one pick required per league that has fixtures that week (so up to four picks in a full week, fewer if a league has no fixtures/is a thin week per section 2); click a team name in each league to pick them as winner; teams the player has already used this run are greyed out and unclickable per league; clicking "Next" submits all of that week's picks together, then continues to step 4. In read-only mode, the player's own pick is shown highlighted with no other interaction available.
   - Skipped entirely for eliminated players — they go straight to step 4 (redirected past the LMS screen rather than shown a disabled version of it; confirmed as the intended behaviour)
4. **Score Predictor** *(reached via "Make picks" or "View my picks", after step 3)* — the same 5 randomly-selected fixtures for every player; enter a predicted score for each; clicking "Next" submits and returns to the branch/leaderboard. In read-only mode, shows the player's already-submitted scores with no inputs. Stays fully playable for eliminated players — no elimination check on this path.
5. **Leaderboard** — reachable directly from step 2, or automatically after finishing picks in steps 3-4. Three panels:
   - LMS: current run status, each surviving player's lives remaining, past run winners
   - Predictor: season-long points table (1 pt correct result, 3 pts exact score — total, not stacked)
   - LMS Points (season): running total of each player's points-pot payouts across every finished run (section 6a)

## 4. Seed data
Players (seeded directly into the DB, no admin UI needed for this):
`Tom, Goods, Kev, Rich, Ed, Gary, Martin`

Each player has a passcode (plaintext distributed by whoever runs the pool, hashed at rest) entered after picking their name on screen 1 — a lightweight gate, not real authentication. See section 8.

## 5. Data model (draft v6)

```
players
  id, name, created_at, passcode_hash (nullable)  -- seeded, seven rows to start

leagues
  id, name                                        -- Premier League, Championship, League One, League Two

runs                                              -- Last Man Standing runs only
  id, run_number, started_at, ended_at
  winners: many-to-many with players               -- usually one, joint on a shared final-week elimination (section 6)

run_entries                                        -- one row per player per run, tracks lives
  id, run_id, player_id, lives_remaining (starts at 4), eliminated, eliminated_at_week_id (nullable),
  lms_points_awarded (nullable)                     -- null until the run ends, then this player's payout (section 6a)

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

used_teams                                        -- derive from lms_picks: every team picked this run,
  player_id, run_id, team_name                     -- regardless of correct/incorrect (section 6)
```

## 6. Last Man Standing — survival rule (lives)
Each player gets **4 lives per run**. Every wrong, postponed, or missing pick costs one life (a week with multiple league picks can cost multiple lives — one per miss, not capped at one per week). Lives floor at 0 rather than going negative; a player isn't eliminated for merely reaching 0 lives, only when they then miss again while already at 0 — i.e. their 5th miss ends their run. Screen 5 shows each surviving player's lives remaining.

**Ties**: if every player still in the run is eliminated in the same week (all hit their 5th miss together), they're declared **joint winners** of that run rather than the run continuing with no survivors.

## 6a. LMS points pot
A separate scoring layer on top of the survival rule above — doesn't change who gets eliminated or how, just adds a points payout once a run finishes.

Each run has its own pot, starting at 4 points and growing by 4 for every game week that passes (settled or skipped — a thin week with no fixtures still adds its 4 points). The pot resets to 0 when a new run starts.

When the run ends, the final pot is split 60% / 25% / 15% among whoever survived longest / 2nd-longest / 3rd-longest, ranked by elimination week (the winner(s) rank highest, then most-recently-eliminated, and so on).

**Ties**: players tied for a rank absorb as many consecutive payout tiers as there are people tied, pool those percentages, and split the pooled amount evenly — e.g. two joint winners split 60%+25%=85% between them (42.5% each), and whoever's next takes the remaining 15% as "3rd" (there's no "2nd"). Same logic applies further down: two players tied for 2nd/3rd split 25%+15%=40% between them, while a lone winner still keeps 60% outright.

Players who don't place in the top 3 (or the equivalent tied group) get 0 from this run. Screen 5 shows a season-long "LMS Points" table — a running total of each player's payouts added up across every run that's finished so far, alongside (not replacing) the current run's live/eliminated status panel.

**Used teams**: once picked, a team is unavailable again for the rest of the run — regardless of whether that pick turned out right or wrong. A wrong pick that survives on a life still burns the team, so nobody can just keep re-picking the same favourite and treating lives as free insurance.

## 6b. Friday deadline report (email)
Once picks lock (Friday 12:00 UK), send a report email **5 minutes later (12:05 UK)** showing everyone's picks for that game week.

- **Recipient**: hardcoded to `whitfield.tom@gmail.com` for now, via the `REPORT_RECIPIENT_EMAIL` env var — a single config value, not scattered through the code, so it's a one-line change to support multiple recipients later.
- **Sender service**: **Resend**, via a plain HTTP call (`src/lib/email.ts`) — no SDK dependency. Sends from Resend's shared sandbox address (`onboarding@resend.dev`, configurable via `EMAIL_FROM`) unless a verified custom domain is set up later.
- **Content/format**: plain text (not HTML), tab-separated so it pastes cleanly into a spreadsheet (`src/lib/report.ts`). Two tables:
  - LAST MAN STANDING: player name, then their pick for each league that had fixtures that week (blank if that league had none, or if the player didn't submit)
  - SCORE PREDICTOR: player name, then their predicted score for each of the 5 fixtures
- **Timezone handling (built)**: rather than re-deriving UK local time at send time, this leans on `pickDeadline` already being computed DST-safely when the game week is created (`ukNoonUtc()` in `weeklyJob.ts`, which asks `Intl.DateTimeFormat` for the actual `Europe/London` wall-clock hour). `.github/workflows/friday-report.yml` fires the job at **both** `12:05 UTC` (matches 12:05 UK during GMT) and `11:05 UTC` (matches 12:05 UK during BST) every Friday. The `/api/cron/friday-report` endpoint looks for a game week whose stored `pickDeadline` fell within the last 50 minutes — only the trigger that actually lines up with that week's real deadline ever finds a match, so it self-corrects across the DST changeover with no separate timezone check needed in the job itself. `report_sent_at` (section 5) guards against a double-send if both triggers somehow matched in the same run. The window is 50 minutes rather than a tight ~5 — GitHub Actions scheduled runs are best-effort and can lag well past their nominal time (the first live run confirmed this: it fired, got a 200, but landed outside an initial 20-minute window and silently sent nothing), so 50 minutes gives real headroom while staying under the 60-minute gap to the other DST trigger.

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

**Auth**: the free tier has no personal key — everyone free uses the same shared key `123`. Our actual call volume (~12 requests once a week) is tiny next to the 30 requests/minute free rate limit.

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
