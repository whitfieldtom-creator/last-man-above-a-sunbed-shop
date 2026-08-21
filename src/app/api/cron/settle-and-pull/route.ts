import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { runWeeklySettleAndPull } from "@/lib/weeklyJob";

// Triggered once a week (Tuesday) by .github/workflows/weekly-settle.yml.
// Settles the previous game week and pulls the next fixture window —
// see last-man-standing-plan.md section 1.
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
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
