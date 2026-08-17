/*
  Warnings:

  - You are about to drop the column `winnerPlayerId` on the `Run` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Run" DROP CONSTRAINT "Run_winnerPlayerId_fkey";

-- AlterTable
ALTER TABLE "Run" DROP COLUMN "winnerPlayerId";

-- CreateTable
CREATE TABLE "RunEntry" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "livesRemaining" INTEGER NOT NULL DEFAULT 4,
    "eliminated" BOOLEAN NOT NULL DEFAULT false,
    "eliminatedAtWeekId" INTEGER,

    CONSTRAINT "RunEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RunWinners" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RunWinners_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "RunEntry_runId_playerId_key" ON "RunEntry"("runId", "playerId");

-- CreateIndex
CREATE INDEX "_RunWinners_B_index" ON "_RunWinners"("B");

-- AddForeignKey
ALTER TABLE "RunEntry" ADD CONSTRAINT "RunEntry_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunEntry" ADD CONSTRAINT "RunEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunEntry" ADD CONSTRAINT "RunEntry_eliminatedAtWeekId_fkey" FOREIGN KEY ("eliminatedAtWeekId") REFERENCES "GameWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RunWinners" ADD CONSTRAINT "_RunWinners_A_fkey" FOREIGN KEY ("A") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RunWinners" ADD CONSTRAINT "_RunWinners_B_fkey" FOREIGN KEY ("B") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
