import Link from "next/link";

// Screen 2: Last Man Standing pick — one pick per league with fixtures this week.
// See last-man-standing-plan.md section 3.
export default function LmsPickPage() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Last Man Standing</h1>
      <p>Pick screen coming soon.</p>
      <Link href="/predictor">Next: Score Predictor</Link>
    </main>
  );
}
