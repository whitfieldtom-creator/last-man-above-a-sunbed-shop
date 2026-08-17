import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Triggered once a week (Monday) by .github/workflows/weekly-settle.yml.
// Settles the previous game week and pulls the next fixture window —
// see last-man-standing-plan.md section 1.
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "");

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: find/create the Run + this week's GameWeek (nothing bootstraps
  // these yet), then:
  //   1. pullFixturesForGameWeek() from src/lib/fixtures.ts against last
  //      week's GameWeek (it re-syncs results for already-stored fixtures,
  //      which is how settlement reads scores — see plan section 11)
  //   2. settleLmsGameWeek() from src/lib/lms.ts for that same week
  //   3. settle Predictor scoring for that week (not implemented yet)
  //   4. pullFixturesForGameWeek() again for the new upcoming GameWeek
  //   5. selectPredictorFixtures() from src/lib/fixtures.ts for that new week

  return NextResponse.json({ ok: true });
}
