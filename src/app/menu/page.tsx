import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentGameWeek, getCurrentPlayer } from "@/lib/session";

// Screen 2: branch — "Make picks" (or "View my picks" once locked) / "View
// leaderboard". See last-man-standing-plan.md section 3.
export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/");

  const gameWeek = await getCurrentGameWeek();
  const locked = gameWeek ? new Date() > gameWeek.pickDeadline : false;
  const picksLabel = locked ? "View my picks" : "Make picks";

  return (
    <main>
      <p className="eyebrow">Screen 2</p>
      <h2>{player.name}</h2>
      {!gameWeek && <p className="text-muted">No game week open right now — check back after the next pull.</p>}
      <div className="stack">
        <Link href="/lms" className="btn btn-primary">
          {picksLabel}
        </Link>
        <Link href="/results" className="btn">
          View leaderboard
        </Link>
      </div>
    </main>
  );
}
