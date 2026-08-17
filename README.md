# Last Man Above A Sunbed Shop

Last Man Standing + Score Predictor. See [last-man-standing-plan.md](./last-man-standing-plan.md) for the full spec.

## Stack

- Next.js (App Router) — frontend + API routes in one deployable service
- Prisma 7 + Postgres (`@prisma/adapter-pg` driver adapter)
- Hosting: Railway (always-on, no cold starts)
- Fixture data: [API-Football](https://dashboard.api-football.com)
- Weekly settle/pull: GitHub Actions cron → `POST /api/cron/settle-and-pull`

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, API_FOOTBALL_KEY, CRON_SECRET
npx prisma migrate dev       # creates tables
npx prisma db seed           # seeds the 6 players + 4 leagues
npm run dev
```

## Deploying (Railway)

1. New Railway project → deploy from this GitHub repo.
2. Add a Postgres plugin; Railway sets `DATABASE_URL` for you.
3. Add env vars: `API_FOOTBALL_KEY`, `CRON_SECRET` (same value as the GitHub Actions secret below).
4. Run `npx prisma migrate deploy` and `npx prisma db seed` against the Railway DB once.

## Weekly cron (GitHub Actions)

`.github/workflows/weekly-settle.yml` calls the settle-and-pull endpoint every Monday. Add these repo secrets (Settings → Secrets and variables → Actions):

- `APP_URL` — your Railway deployment URL (e.g. `https://lastman.up.railway.app`)
- `CRON_SECRET` — must match the value set in Railway
