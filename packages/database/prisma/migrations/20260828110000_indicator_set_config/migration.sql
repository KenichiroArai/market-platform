-- AlterTable: IndicatorSet にパラメータ上書き・スコア配点・閾値を追加（ADR 014）
ALTER TABLE "IndicatorSet" ADD COLUMN "indicatorParams" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "IndicatorSet" ADD COLUMN "groupWeights" JSONB;
ALTER TABLE "IndicatorSet" ADD COLUMN "buyThreshold" DOUBLE PRECISION;
ALTER TABLE "IndicatorSet" ADD COLUMN "sellThreshold" DOUBLE PRECISION;
