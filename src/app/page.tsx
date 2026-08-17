import { prisma } from "@/lib/db";
import PlayerPicker from "./PlayerPicker";

export const dynamic = "force-dynamic";

export default async function ChoosePlayerPage() {
  const players = await prisma.player.findMany({
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Last Man Above A Sunbed Shop</h1>
      <p>Choose your player</p>
      <PlayerPicker players={players} />
    </main>
  );
}
