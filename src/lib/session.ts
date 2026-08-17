import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export async function getCurrentPlayer() {
  const cookieStore = await cookies();
  const playerId = Number(cookieStore.get("playerId")?.value);
  if (!Number.isInteger(playerId)) return null;
  return prisma.player.findUnique({ where: { id: playerId } });
}

export function getPlayerIdFromRequest(request: NextRequest): number | null {
  const playerId = Number(request.cookies.get("playerId")?.value);
  return Number.isInteger(playerId) ? playerId : null;
}

// The game week currently accepting picks — the active run's latest week
// that hasn't been settled or skipped yet.
export async function getCurrentGameWeek() {
  return prisma.gameWeek.findFirst({
    where: { run: { endedAt: null }, status: { in: ["open", "locked"] } },
    orderBy: { weekNumber: "desc" },
  });
}
