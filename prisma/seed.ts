import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PLAYERS = ["Tom", "Goods", "Kev", "Rich", "Ed", "Martin"];
const LEAGUES = ["Premier League", "Championship", "League One", "League Two"];

async function main() {
  for (const name of PLAYERS) {
    await prisma.player.upsert({
      where: { name },
      update: {},
      create: { name },
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
