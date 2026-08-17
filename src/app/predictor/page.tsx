import Link from "next/link";

// Screen 3: Score Predictor — same 5 fixtures for every player.
// See last-man-standing-plan.md section 3.
export default function PredictorPickPage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Score Predictor</h1>
      <p>Predictor screen coming soon.</p>
      <Link href="/results">Next: Results</Link>
    </main>
  );
}
