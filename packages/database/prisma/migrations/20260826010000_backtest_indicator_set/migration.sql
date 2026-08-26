-- Ph3: BacktestRun を IndicatorSet 起点 + 戦略スナップショットへ拡張

-- AlterTable: 新規列を追加（既存行向けに一時デフォルト付き）
ALTER TABLE "BacktestRun" ADD COLUMN "indicatorSetId" TEXT;
ALTER TABLE "BacktestRun" ADD COLUMN "strategyType" "SignalStrategyType";
ALTER TABLE "BacktestRun" ADD COLUMN "paramsJson" JSONB;

-- 既存行を SignalDefinition からバックフィル
UPDATE "BacktestRun" AS br
SET
  "strategyType" = sd."strategyType",
  "paramsJson" = sd."paramsJson"
FROM "SignalDefinition" AS sd
WHERE br."signalDefinitionId" = sd."id"
  AND br."strategyType" IS NULL;

-- 孤児行向けフォールバック（通常は発生しない）
UPDATE "BacktestRun"
SET
  "strategyType" = 'SMA_CROSS',
  "paramsJson" = '{"shortPeriod":25,"longPeriod":75}'::jsonb
WHERE "strategyType" IS NULL OR "paramsJson" IS NULL;

ALTER TABLE "BacktestRun" ALTER COLUMN "strategyType" SET NOT NULL;
ALTER TABLE "BacktestRun" ALTER COLUMN "paramsJson" SET NOT NULL;

-- signalDefinitionId を任意化
ALTER TABLE "BacktestRun" ALTER COLUMN "signalDefinitionId" DROP NOT NULL;

-- 旧 FK を SetNull に差し替え
ALTER TABLE "BacktestRun" DROP CONSTRAINT IF EXISTS "BacktestRun_signalDefinitionId_fkey";
ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_signalDefinitionId_fkey"
  FOREIGN KEY ("signalDefinitionId") REFERENCES "SignalDefinition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BacktestRun" ADD CONSTRAINT "BacktestRun_indicatorSetId_fkey"
  FOREIGN KEY ("indicatorSetId") REFERENCES "IndicatorSet"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BacktestRun_indicatorSetId_idx" ON "BacktestRun"("indicatorSetId");
