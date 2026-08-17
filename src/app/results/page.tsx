import Link from "next/link";

// Screen 4: Results / leaderboard — LMS run status + Predictor points table.
// See last-man-standing-plan.md section 3.
export default function ResultsPage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Results</h1>
      <p>Leaderboard coming soon.</p>
      <Link href="/">Back to start</Link>
    </main>
  );
}
