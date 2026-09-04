import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { REPORT_RECIPIENT_EMAIL, sendEmail } from "@/lib/email";
import { buildFridayReportEmail } from "@/lib/report";

// Triggered several times every Friday afternoon/evening by
// .github/workflows/friday-report.yml (covering both GMT and BST, plus
// same-day catch-up times) — see last-man-standing-plan.md section 6b.
//
// No time window here on purpose. An earlier version only matched a game
// week whose deadline fell within the last N minutes, on the assumption
// that GitHub Actions might lag by a bit — but live runs showed it lagging
// by up to ~10 hours, and some scheduled triggers not firing at all some
// weeks. Rather than chase an ever-larger window (which risks colliding
// with the *other* DST trigger once it gets close to 60 minutes), this just
// finds the most recent game week whose deadline has passed and whose
// report hasn't gone out yet, with no upper bound on how late that is.
// `reportSentAt` already makes this safe to call as often as needed — first
// call to find a match sends and marks it, every call after is a no-op.
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dueGameWeek = await prisma.gameWeek.findFirst({
    where: { reportSentAt: null, pickDeadline: { lte: now } },
    orderBy: { pickDeadline: "desc" },
  });

  if (!dueGameWeek) {
    return NextResponse.json({ ok: true, sent: false, reason: "No game week with an unreported passed deadline" });
  }

  try {
    const report = await buildFridayReportEmail(dueGameWeek.id);
    if (report) {
      await sendEmail({ to: REPORT_RECIPIENT_EMAIL, subject: report.subject, html: report.html });
    }
    await prisma.gameWeek.update({ where: { id: dueGameWeek.id }, data: { reportSentAt: now } });
    return NextResponse.json({ ok: true, sent: report !== null, gameWeekId: dueGameWeek.id });
  } catch (err) {
    console.error("friday-report failed:", err);
    return NextResponse.json({ error: "Job failed", detail: String(err) }, { status: 500 });
  }
}
