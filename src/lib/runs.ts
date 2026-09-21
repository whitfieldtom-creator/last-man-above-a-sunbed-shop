import { prisma } from "@/lib/db";

// The most recently finished LMS run, with its winner(s) — the current
// "reigning champion(s)". Used by the ticker and the home screen crown.
export async function getLastFinishedRun() {
  return prisma.run.findFirst({
    where: { endedAt: { not: null } },
    orderBy: { runNumber: "desc" },
    include: { winners: true },
  });
}
