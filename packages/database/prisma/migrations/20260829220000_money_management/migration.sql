-- AlterEnum
CREATE TYPE "TradeSidePolicy" AS ENUM ('LONG_ONLY', 'LONG_SHORT');
CREATE TYPE "FeeMode" AS ENUM ('RATE', 'FIXED');

-- AlterTable BacktestRun
ALTER TABLE "BacktestRun" ADD COLUMN "feeMode" "FeeMode" NOT NULL DEFAULT 'RATE';
ALTER TABLE "BacktestRun" ADD COLUMN "feeFixed" DECIMAL(18,6) NOT NULL DEFAULT 0;
ALTER TABLE "BacktestRun" ADD COLUMN "tradeSidePolicy" "TradeSidePolicy" NOT NULL DEFAULT 'LONG_ONLY';
ALTER TABLE "BacktestRun" ADD COLUMN "moneyManagementJson" JSONB;
ALTER TABLE "BacktestRun" ADD COLUMN "moneyManagementStatsJson" JSONB;

-- AlterTable BacktestTrade
ALTER TABLE "BacktestTrade" ADD COLUMN "atr" DECIMAL(18,6);
ALTER TABLE "BacktestTrade" ADD COLUMN "n" DECIMAL(18,6);
ALTER TABLE "BacktestTrade" ADD COLUMN "riskRate" DECIMAL(12,6);
ALTER TABLE "BacktestTrade" ADD COLUMN "initialQuantity" DECIMAL(18,6);
ALTER TABLE "BacktestTrade" ADD COLUMN "addCount" INTEGER;
ALTER TABLE "BacktestTrade" ADD COLUMN "stopPrice" DECIMAL(18,6);
ALTER TABLE "BacktestTrade" ADD COLUMN "unitCount" INTEGER;
