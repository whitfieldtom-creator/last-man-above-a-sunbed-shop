import { prisma } from "@/lib/db";
import PlayerPicker from "./PlayerPicker";

export const dynamic = "force-dynamic";

export default async function ChoosePlayerPage() {
  const players = await prisma.player.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  return (
    <main>
      <p className="eyebrow">Screen 1</p>
      <h2>Choose your player</h2>
      <PlayerPicker players={players} />
    </main>
  );
}
