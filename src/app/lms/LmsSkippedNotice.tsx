import Link from "next/link";

// Shown instead of the pick screen when LMS is skipped for the week
// (a league people still have lives in has no games — see
// last-man-standing-plan.md section 2).
export default function LmsSkippedNotice({ weekNumber }: { weekNumber: number }) {
  return (
    <main>
      <p className="eyebrow">Screen 3 · Week {weekNumber}</p>
      <h2>Last Man Standing</h2>
      <div className="panel">
        <p>
          Have a week off from LMS — enjoy some time with family, or visit{" "}
          <a
            href="https://maps.app.goo.gl/WuzMt2puHzwkyvK29"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent-gold)", textDecoration: "underline" }}
          >
            a local attraction
          </a>
          .
        </p>
        <p className="text-muted">
          A league that people still have lives in has no games this week, so nobody picks and nobody loses a life —
          everyone&apos;s leagues stay exactly as they are. The Score Predictor is still on.
        </p>
      </div>
      <Link href="/predictor" className="btn btn-primary">
        Next
      </Link>
      <p style={{ marginTop: "1rem" }}>
        <Link href="/menu" className="link-btn">
          ← Back to menu
        </Link>
      </p>
    </main>
  );
}
