-- AlterTable BacktestRun: 損切／利確方針スナップショット（ADR 019）
ALTER TABLE "BacktestRun" ADD COLUMN "exitPolicyJson" JSONB;
