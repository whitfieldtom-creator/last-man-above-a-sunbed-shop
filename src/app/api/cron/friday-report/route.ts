import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { REPORT_RECIPIENT_EMAIL, sendEmail } from "@/lib/email";
import { buildFridayReportEmail } from "@/lib/report";

// Triggered twice every Friday (12:05 UTC and 11:05 UTC) by
// .github/workflows/friday-report.yml — one covers GMT, the other BST.
// `pickDeadline` is already computed DST-safely at game-week creation time
// (see ukNoonUtc in weeklyJob.ts), so rather than re-deriving UK local time
// here, we just look for a game week whose deadline fell recently: only the
// trigger that actually lines up with this week's real UK-noon deadline
// will ever find a match. See last-man-standing-plan.md section 6b.
//
// Window is 50 minutes, not the ~5 minutes you'd expect from "runs 5
// minutes after the deadline" — GitHub Actions scheduled runs are
// best-effort and documented to lag by well more than that under load (the
// first live run of this workflow landed outside a 20-minute window and
// silently no-op'd). 50 minutes gives real headroom while staying safely
// under the 60-minute gap to the *other* DST trigger, so it can never
// accidentally match the wrong week's deadline.
const MATCH_WINDOW_MS = 50 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueGameWeek = await prisma.gameWeek.findFirst({
    where: {
      reportSentAt: null,
      pickDeadline: { lte: now, gt: new Date(now.getTime() - MATCH_WINDOW_MS) },
    },
    orderBy: { pickDeadline: "desc" },
  });

  if (!dueGameWeek) {
    return NextResponse.json({ ok: true, sent: false, reason: "No game week deadline in the current match window" });
  }

  try {
    const report = await buildFridayReportEmail(dueGameWeek.id);
    if (report) {
      await sendEmail({ to: REPORT_RECIPIENT_EMAIL, subject: report.subject, text: report.text });
    }
    await prisma.gameWeek.update({ where: { id: dueGameWeek.id }, data: { reportSentAt: now } });
    return NextResponse.json({ ok: true, sent: report !== null, gameWeekId: dueGameWeek.id });
  } catch (err) {
    console.error("friday-report failed:", err);
    return NextResponse.json({ error: "Job failed", detail: String(err) }, { status: 500 });
  }
}
