-- Phase 2: 銘柄マスタ（Symbol）と日足価格（DailyPrice）
-- CreateEnum
CREATE TYPE "Market" AS ENUM ('US', 'JP');

-- CreateTable
CREATE TABLE "Symbol" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "exchange" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Symbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPrice" (
    "id" TEXT NOT NULL,
    "symbolId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DECIMAL(18,6) NOT NULL,
    "high" DECIMAL(18,6) NOT NULL,
    "low" DECIMAL(18,6) NOT NULL,
    "close" DECIMAL(18,6) NOT NULL,
    "volume" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Symbol_market_idx" ON "Symbol"("market");

-- CreateIndex
CREATE UNIQUE INDEX "Symbol_ticker_market_key" ON "Symbol"("ticker", "market");

-- CreateIndex
CREATE INDEX "DailyPrice_date_idx" ON "DailyPrice"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPrice_symbolId_date_key" ON "DailyPrice"("symbolId", "date");

-- AddForeignKey
ALTER TABLE "DailyPrice" ADD CONSTRAINT "DailyPrice_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "Symbol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
