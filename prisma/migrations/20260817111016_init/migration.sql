-- CreateEnum
CREATE TYPE "GameWeekStatus" AS ENUM ('open', 'locked', 'settled', 'skipped');

-- CreateEnum
CREATE TYPE "FixtureResult" AS ENUM ('pending', 'home', 'away', 'draw', 'postponed');

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" SERIAL NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "winnerPlayerId" INTEGER,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameWeek" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "pickDeadline" TIMESTAMP(3) NOT NULL,
    "status" "GameWeekStatus" NOT NULL DEFAULT 'open',

    CONSTRAINT "GameWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" SERIAL NOT NULL,
    "gameWeekId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "kickoffTime" TIMESTAMP(3) NOT NULL,
    "result" "FixtureResult" NOT NULL DEFAULT 'pending',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictorFixture" (
    "id" SERIAL NOT NULL,
    "gameWeekId" INTEGER NOT NULL,
    "fixtureId" INTEGER NOT NULL,

    CONSTRAINT "PredictorFixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsPick" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "gameWeekId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "teamPicked" TEXT NOT NULL,
    "correct" BOOLEAN,

    CONSTRAINT "LmsPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictorPick" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "predictorFixtureId" INTEGER NOT NULL,
    "predictedHomeScore" INTEGER NOT NULL,
    "predictedAwayScore" INTEGER NOT NULL,
    "pointsAwarded" INTEGER,

    CONSTRAINT "PredictorPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsedTeam" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "runId" INTEGER NOT NULL,
    "teamName" TEXT NOT NULL,

    CONSTRAINT "UsedTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "League_name_key" ON "League"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Run_runNumber_key" ON "Run"("runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GameWeek_runId_weekNumber_key" ON "GameWeek"("runId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_externalId_key" ON "Fixture"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictorFixture_fixtureId_key" ON "PredictorFixture"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "LmsPick_playerId_gameWeekId_leagueId_key" ON "LmsPick"("playerId", "gameWeekId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictorPick_playerId_predictorFixtureId_key" ON "PredictorPick"("playerId", "predictorFixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "UsedTeam_playerId_runId_teamName_key" ON "UsedTeam"("playerId", "runId", "teamName");

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_winnerPlayerId_fkey" FOREIGN KEY ("winnerPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameWeek" ADD CONSTRAINT "GameWeek_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_gameWeekId_fkey" FOREIGN KEY ("gameWeekId") REFERENCES "GameWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictorFixture" ADD CONSTRAINT "PredictorFixture_gameWeekId_fkey" FOREIGN KEY ("gameWeekId") REFERENCES "GameWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictorFixture" ADD CONSTRAINT "PredictorFixture_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsPick" ADD CONSTRAINT "LmsPick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsPick" ADD CONSTRAINT "LmsPick_gameWeekId_fkey" FOREIGN KEY ("gameWeekId") REFERENCES "GameWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsPick" ADD CONSTRAINT "LmsPick_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsPick" ADD CONSTRAINT "LmsPick_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictorPick" ADD CONSTRAINT "PredictorPick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictorPick" ADD CONSTRAINT "PredictorPick_predictorFixtureId_fkey" FOREIGN KEY ("predictorFixtureId") REFERENCES "PredictorFixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedTeam" ADD CONSTRAINT "UsedTeam_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsedTeam" ADD CONSTRAINT "UsedTeam_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
