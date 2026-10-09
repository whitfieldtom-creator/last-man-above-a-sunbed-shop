// Calls one of the app's cron endpoints, for use as a Railway cron service
// (see railway.friday-report.json / railway.settle-and-pull.json).
//
//   node scripts/trigger-cron.mjs friday-report
//   node scripts/trigger-cron.mjs settle-and-pull
//
// Needs APP_URL and CRON_SECRET in the environment. Both endpoints are
// idempotent (reportSentAt / the settle checks), so running more often than
// strictly needed is safe. Exits non-zero on failure so Railway marks the run
// as failed instead of silently succeeding.

const ALLOWED = new Set(["friday-report", "settle-and-pull"]);
const job = process.argv[2];
const { APP_URL, CRON_SECRET } = process.env;

if (!ALLOWED.has(job)) {
  console.error(`Usage: trigger-cron.mjs <${[...ALLOWED].join("|")}>`);
  process.exit(2);
}
if (!APP_URL || !CRON_SECRET) {
  console.error("APP_URL and CRON_SECRET must be set");
  process.exit(2);
}

const url = `${APP_URL.replace(/\/+$/, "")}/api/cron/${job}`;

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${CRON_SECRET}` } });
    const body = await res.text();
    console.log(`${job} attempt ${attempt}: HTTP ${res.status} ${body}`);
    if (res.ok) process.exit(0);
  } catch (err) {
    console.error(`${job} attempt ${attempt} failed:`, err);
  }
  if (attempt < 3) await new Promise((r) => setTimeout(r, 15_000));
}
process.exit(1);
