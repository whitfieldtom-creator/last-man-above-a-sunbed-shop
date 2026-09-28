-- CreateTable
CREATE TABLE "WinToStayIn" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "holderPlayerId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WinToStayIn_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WinToStayIn" ADD CONSTRAINT "WinToStayIn_holderPlayerId_fkey" FOREIGN KEY ("holderPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

