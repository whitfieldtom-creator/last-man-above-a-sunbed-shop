-- DropForeignKey
ALTER TABLE "UsedTeam" DROP CONSTRAINT "UsedTeam_playerId_fkey";

-- DropForeignKey
ALTER TABLE "UsedTeam" DROP CONSTRAINT "UsedTeam_runId_fkey";

-- AlterTable
ALTER TABLE "RunEntry" DROP COLUMN "livesRemaining";

-- DropTable
DROP TABLE "UsedTeam";

-- CreateTable
CREATE TABLE "PlayerLeagueLife" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "alive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlayerLeagueLife_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerLeagueLife_runId_playerId_leagueId_key" ON "PlayerLeagueLife"("runId", "playerId", "leagueId");

-- AddForeignKey
ALTER TABLE "PlayerLeagueLife" ADD CONSTRAINT "PlayerLeagueLife_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerLeagueLife" ADD CONSTRAINT "PlayerLeagueLife_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerLeagueLife" ADD CONSTRAINT "PlayerLeagueLife_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

