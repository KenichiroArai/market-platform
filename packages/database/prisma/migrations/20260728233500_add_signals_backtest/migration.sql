-- Phase 5: シグナル定義・バックテスト永続化
-- CreateEnum
CREATE TYPE "SignalStrategyType" AS ENUM ('SMA_CROSS', 'RSI_THRESHOLD', 'MACD_CROSS');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "SignalDefinition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategyType" "SignalStrategyType" NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signalDefinitionId" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "initialCash" DECIMAL(18,6) NOT NULL,
    "feeRate" DECIMAL(12,6) NOT NULL,
    "slippageRate" DECIMAL(12,6) NOT NULL,
    "finalEquity" DECIMAL(18,6) NOT NULL,
    "totalReturnRate" DECIMAL(12,6) NOT NULL,
    "maxDrawdownRate" DECIMAL(12,6) NOT NULL,
    "totalTrades" INTEGER NOT NULL,
    "winRate" DECIMAL(12,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestTrade" (
    "id" TEXT NOT NULL,
    "backtestRunId" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "exitDate" DATE NOT NULL,
    "entryPrice" DECIMAL(18,6) NOT NULL,
    "exitPrice" DECIMAL(18,6) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "side" "TradeSide" NOT NULL,
    "grossPnl" DECIMAL(18,6) NOT NULL,
    "feeAmount" DECIMAL(18,6) NOT NULL,
    "slippageAmount" DECIMAL(18,6) NOT NULL,
    "netPnl" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacktestTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BacktestEquityPoint" (
    "id" TEXT NOT NULL,
    "backtestRunId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "cash" DECIMAL(18,6) NOT NULL,
    "positionValue" DECIMAL(18,6) NOT NULL,
    "equity" DECIMAL(18,6) NOT NULL,
    "drawdownRate" DECIMAL(12,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacktestEquityPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignalDefinition_userId_name_key" ON "SignalDefinition"("userId", "name");

-- CreateIndex
CREATE INDEX "SignalDefinition_userId_idx" ON "SignalDefinition"("userId");

-- CreateIndex
CREATE INDEX "SignalDefinition_strategyType_idx" ON "SignalDefinition"("strategyType");

-- CreateIndex
CREATE INDEX "BacktestRun_userId_createdAt_idx" ON "BacktestRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BacktestRun_signalDefinitionId_idx" ON "BacktestRun"("signalDefinitionId");

-- CreateIndex
CREATE INDEX "BacktestRun_symbolId_idx" ON "BacktestRun"("symbolId");

-- CreateIndex
CREATE INDEX "BacktestTrade_backtestRunId_entryDate_idx" ON "BacktestTrade"("backtestRunId", "entryDate");

-- CreateIndex
CREATE INDEX "BacktestTrade_symbolId_idx" ON "BacktestTrade"("symbolId");

-- CreateIndex
CREATE UNIQUE INDEX "BacktestEquityPoint_backtestRunId_date_key" ON "BacktestEquityPoint"("backtestRunId", "date");

-- CreateIndex
CREATE INDEX "BacktestEquityPoint_date_idx" ON "BacktestEquityPoint"("date");

-- AddForeignKey
ALTER TABLE "SignalDefinition" ADD CONSTRAINT "SignalDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_signalDefinitionId_fkey" FOREIGN KEY ("signalDefinitionId") REFERENCES "SignalDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestTrade" ADD CONSTRAINT "BacktestTrade_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "BacktestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestTrade" ADD CONSTRAINT "BacktestTrade_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BacktestEquityPoint" ADD CONSTRAINT "BacktestEquityPoint_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "BacktestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
