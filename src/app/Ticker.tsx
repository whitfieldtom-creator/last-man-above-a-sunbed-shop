import { getTickerContent } from "@/lib/ticker";

// The signature vidiprinter strip — see design-spec.md. What it says is
// decided in lib/ticker.ts.
export default async function Ticker() {
  const content = await getTickerContent();

  // The marquee loops by scrolling two identical copies, which only looks
  // seamless if each copy is wider than the screen — a short message
  // would leave a gap, so repeat it to fill the strip.
  const separator = "  ***  ";
  const repeats = Math.max(1, Math.ceil(260 / (content.length + separator.length)));
  const track = Array(repeats).fill(content).join(separator);

  // Scroll speed scales with length so a long list of news doesn't fly past.
  const durationSeconds = Math.max(20, Math.round(track.length * 0.16));

  return (
    <div className="ticker">
      <div className="ticker-track" style={{ animationDuration: `${durationSeconds}s` }}>
        <span>{track}</span>
        <span aria-hidden="true">{track}</span>
      </div>
    </div>
  );
}
