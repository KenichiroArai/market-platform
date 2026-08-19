-- v0.2.0 Phase 5: ユーザー所有の名前付き指標セット
-- CreateTable
CREATE TABLE "IndicatorSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "indicatorIds" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndicatorSet_userId_idx" ON "IndicatorSet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorSet_userId_name_key" ON "IndicatorSet"("userId", "name");

-- AddForeignKey
ALTER TABLE "IndicatorSet" ADD CONSTRAINT "IndicatorSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
