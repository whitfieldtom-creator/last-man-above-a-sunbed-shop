import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { runWeeklySettleAndPull } from "@/lib/weeklyJob";

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

  try {
    const result = await runWeeklySettleAndPull();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("settle-and-pull failed:", err);
    return NextResponse.json({ error: "Job failed", detail: String(err) }, { status: 500 });
  }
}
