-- BacktestRun に論理削除フラグ isActive を追加する。
ALTER TABLE "BacktestRun" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "BacktestRun_userId_isActive_createdAt_idx" ON "BacktestRun"("userId", "isActive", "createdAt");
