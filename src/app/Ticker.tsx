import { getLastFinishedRun } from "@/lib/runs";
import { getCurrentGameWeek } from "@/lib/session";

// The signature vidiprinter strip — see design-spec.md. During the first
// week of a run it announces the previous run's winner(s); after that it
// just shows the current week. Deliberately says nothing about eliminations.
export default async function Ticker() {
  const [gameWeek, lastRun] = await Promise.all([getCurrentGameWeek(), getLastFinishedRun()]);

  let content: string;
  if (gameWeek?.weekNumber === 1 && lastRun && lastRun.winners.length > 0) {
    const names = lastRun.winners.map((w) => w.name.toUpperCase()).join(" & ");
    content = `${names} WIN${lastRun.winners.length === 1 ? "S" : ""} RUN ${lastRun.runNumber}!`;
  } else {
    content = gameWeek ? `WEEK ${gameWeek.weekNumber} UNDERWAY` : "SEASON UNDERWAY";
  }

  // The marquee loops by scrolling two identical copies, which only looks
  // seamless if each copy is wider than the screen — a short message
  // would leave a gap, so repeat it to fill the strip.
  const separator = "  ***  ";
  const repeats = Math.max(1, Math.ceil(260 / (content.length + separator.length)));
  const track = Array(repeats).fill(content).join(separator);

  return (
    <div className="ticker">
      <div className="ticker-track">
        <span>{track}</span>
        <span aria-hidden="true">{track}</span>
      </div>
    </div>
  );
}
