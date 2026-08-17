import { prisma } from "@/lib/db";

// The signature vidiprinter strip — see design-spec.md. Fed by real
// eliminations and run winners, not placeholder text.
export default async function Ticker() {
  const [eliminations, finishedRuns] = await Promise.all([
    prisma.runEntry.findMany({
      where: { eliminated: true },
      include: { player: true },
      orderBy: { eliminatedAtWeekId: "desc" },
      take: 10,
    }),
    prisma.run.findMany({
      where: { endedAt: { not: null } },
      include: { winners: true },
      orderBy: { runNumber: "desc" },
      take: 5,
    }),
  ]);

  const items: string[] = [];

  for (const run of finishedRuns) {
    const names = run.winners.map((w) => w.name.toUpperCase()).join(" & ");
    items.push(`${names} WIN${run.winners.length === 1 ? "S" : ""} RUN ${run.runNumber}!`);
  }
  for (const entry of eliminations) {
    items.push(`${entry.player.name.toUpperCase()} ELIMINATED`);
  }

  const content = items.length > 0 ? items.join("  ***  ") : "SEASON UNDERWAY  ***  NO ELIMINATIONS YET";

  return (
    <div className="ticker">
      <div className="ticker-track">
        <span>{content}</span>
        <span aria-hidden="true">{content}</span>
      </div>
    </div>
  );
}
