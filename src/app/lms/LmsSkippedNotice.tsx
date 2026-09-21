import Link from "next/link";

// Shown instead of the pick screen when LMS is skipped for the week
// (too many leagues idle — see last-man-standing-plan.md section 2).
export default function LmsSkippedNotice({ weekNumber }: { weekNumber: number }) {
  return (
    <main>
      <p className="eyebrow">Screen 3 · Week {weekNumber}</p>
      <h2>Last Man Standing</h2>
      <div className="panel">
        <p>
          Last Man Standing is skipped this week — too many leagues have no games. Nobody picks and nobody loses a
          life; everyone&apos;s leagues stay exactly as they are.
        </p>
        <p className="text-muted">The Score Predictor is still on.</p>
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
