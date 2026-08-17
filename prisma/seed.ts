import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPasscode } from "../src/lib/passcode";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PLAYERS = ["Tom", "Goods", "Kev", "Rich", "Ed", "Gary"];
const LEAGUES = ["Premier League", "Championship", "League One", "League Two"];

// JSON map of name -> plaintext passcode, e.g. {"Tom":"some-word"}.
// Kept out of source control — set in .env.local (and nowhere else).
const passcodes: Record<string, string> = process.env.PLAYER_PASSCODES
  ? JSON.parse(process.env.PLAYER_PASSCODES)
  : {};

async function main() {
  for (const name of PLAYERS) {
    const passcode = passcodes[name];
    if (!passcode) {
      console.warn(`No passcode set for ${name} in PLAYER_PASSCODES — leaving passcodeHash unset.`);
    }

    await prisma.player.upsert({
      where: { name },
      update: passcode ? { passcodeHash: hashPasscode(passcode) } : {},
      create: { name, passcodeHash: passcode ? hashPasscode(passcode) : null },
    });
  }

  for (const name of LEAGUES) {
    await prisma.league.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
