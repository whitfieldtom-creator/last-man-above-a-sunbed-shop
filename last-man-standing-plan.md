# Last Man Above A Sunbed Shop + Score Predictor — Project Plan (Draft v8 — build-ready)

Two games, one app, sharing the same weekly fixture pull:
1. **Last Man Standing (LMS)** — pick one team to win each week; wrong/no pick eliminates you; last one standing wins, then it resets.
2. **Score Predictor** — every player predicts the exact score for the same 5 randomly-selected fixtures each week; running points table, ongoing (no reset).

## 1. Weekly cycle

- **Monday**: single scheduled job does two things in one run:
  1. **Settles last week** — pulls final scores for the previous game week's fixtures, marks LMS picks correct/incorrect (eliminating as needed), scores Predictor picks
  2. **Pulls next window** — fetches fixtures for **next Friday through the Thursday after** (pulled Mon 17 Aug → window is Fri 21 Aug–Thu 27 Aug), across all four English leagues, and randomly selects 5 of those fixtures for that week's Score Predictor
- **Pick deadline**: midday Friday UK time (fixed cutoff, not tied to individual kickoff times) — covers both LMS and Predictor picks for that window
- Leagues: **Premier League, Championship, League One, League Two**

## 2. Postponed fixtures & thin weeks

- **Postponed/delayed fixture, no score by settlement time**:
  - LMS: costs a life the same as a wrong pick (see section 6) — postponements aren't forgiven
  - Predictor: that fixture scores 0 points; doesn't affect their other 4 picks
- **Thin weeks (international breaks, cup weeks) — the two games are handled differently**:
  - **LMS**: doesn't need all four leagues. Use whichever leagues have fixtures that window — e.g. if only League One and League Two are playing, the LMS pick screen just shows those two leagues. Only skip LMS for the week if *zero* leagues have any fixtures at all.
  - **Predictor**: skip the week only if there are fewer than 5 fixtures in total across all four leagues combined (not enough to fill the 5 random picks).

## 3. App flow (4 screens)

1. **Choose player** — select from the seeded player list (see below); no self-serve signup, no in-app creation screen needed
2. **Last Man Standing pick** — one pick required per league that has fixtures that week (so up to four picks in a full week, fewer if a league has no fixtures/is a thin week per section 2); click a team name in each league to pick them as winner; teams the player has already used this run are greyed out and unclickable per league; clicking "Next" submits all of that week's picks together
   - Skipped entirely for eliminated players — they go straight to screen 3
3. **Score Predictor** — the same 5 randomly-selected fixtures for every player; enter a predicted score for each; clicking "Next" submits
4. **Results / leaderboard** — two separate panels:
   - LMS: current run status, each surviving player's lives remaining, past run winners
   - Predictor: season-long points table (1 pt correct result, 3 pts exact score — assuming exact score scores 3 total, not 3 on top of the 1; flag if you meant otherwise)

## 4. Seed data
Players (seeded directly into the DB, no admin UI needed for this):
`Tom, Goods, Kev, Rich, Ed, Martin`

## 5. Data model (draft v3)

```
players
  id, name, created_at                          -- seeded, six rows to start

leagues
  id, name                                        -- Premier League, Championship, League One, League Two

runs                                              -- Last Man Standing runs only
  id, run_number, started_at, ended_at
  winners: many-to-many with players               -- usually one, joint on a shared final-week elimination (section 6)

run_entries                                        -- one row per player per run, tracks lives
  id, run_id, player_id, lives_remaining (starts at 4), eliminated, eliminated_at_week_id (nullable)

game_weeks
  id, run_id, week_number, window_start (Fri), window_end (Thu),
  pick_deadline (Fri 12:00 UK), status (open | locked | settled | skipped)

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

used_teams                                        -- or derive from lms_picks where correct = true
  player_id, run_id, team_name
```

## 6. Last Man Standing — survival rule (lives)
Each player gets **4 lives per run**. Every wrong, postponed, or missing pick costs one life (a week with multiple league picks can cost multiple lives — one per miss, not capped at one per week). Lives floor at 0 rather than going negative; a player isn't eliminated for merely reaching 0 lives, only when they then miss again while already at 0 — i.e. their 5th miss ends their run. Screen 4 shows each surviving player's lives remaining.

**Ties**: if every player still in the run is eliminated in the same week (all hit their 5th miss together), they're declared **joint winners** of that run rather than the run continuing with no survivors.

## 7. Scoring — Score Predictor
- 1 point: correct result (home win / away win / draw) but wrong scoreline
- 3 points: exact scoreline (total — not stacked on top of the 1)
- 0 points: postponed fixture with no result
- Running total across all game weeks, no reset (separate from LMS run resets)

## 8. Admin
No admin UI in the app at all — settlement, result overrides, and any manual week-skipping are managed directly on the backend/database, not through the site. No auth needed anywhere since there's no admin surface exposed to the public app.

## 9. Predictor season boundary
The Predictor table runs continuously through the whole season, including play-offs, and resets only once all league fixtures (play-offs included) are finished — ready for the next season to start fresh.

## 10. Stack (unchanged from v1, confirm before build)
- Frontend: React (Vite)
- Backend: Node.js + Express, or Next.js API routes
- DB: Postgres (Supabase/Neon) or SQLite to start
- Fixture data: API-Football (free tier)
- Scheduler: GitHub Actions weekly cron (Monday) hitting a backend settle+pull endpoint
- Hosting: **Railway** (hobby plan, ~$5/mo) — always-on, no sleep/cold-start, deploy via git push; use Railway's Postgres add-on for the DB rather than a separate Supabase/Neon instance to keep everything in one place
