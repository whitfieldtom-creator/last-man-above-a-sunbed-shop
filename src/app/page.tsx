import { prisma } from "@/lib/db";
import { getLastFinishedRun } from "@/lib/runs";
import PlayerPicker from "./PlayerPicker";

export const dynamic = "force-dynamic";

export default async function ChoosePlayerPage() {
  const [players, lastRun] = await Promise.all([
    prisma.player.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
    getLastFinishedRun(),
  ]);

  return (
    <main>
      <p className="eyebrow">Screen 1</p>
      <h2>Choose your player</h2>
      <PlayerPicker players={players} winnerIds={lastRun?.winners.map((w) => w.id) ?? []} />
    </main>
  );
}
