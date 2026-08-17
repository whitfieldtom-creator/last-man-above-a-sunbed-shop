import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPasscode } from "@/lib/passcode";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const playerId = Number(body?.playerId);
  const passcode = typeof body?.passcode === "string" ? body.passcode : "";

  if (!Number.isInteger(playerId) || !passcode) {
    return NextResponse.json({ error: "Missing playerId or passcode" }, { status: 400 });
  }

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player?.passcodeHash || !verifyPasscode(passcode, player.passcodeHash)) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("playerId", String(player.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
  return response;
}
