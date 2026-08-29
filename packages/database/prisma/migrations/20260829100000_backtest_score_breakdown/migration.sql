-- AlterTable
ALTER TABLE "BacktestTrade" ADD COLUMN "entryScoreBreakdown" JSONB,
ADD COLUMN "exitScoreBreakdown" JSONB;

-- AlterTable
ALTER TABLE "BacktestEquityPoint" ADD COLUMN "decisionScore" DECIMAL(18,6);
