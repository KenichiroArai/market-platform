/**
 * Prisma CLI（migrate / generate 等）向けの設定。
 *
 * v7 では接続 URL を schema.prisma ではなくこのファイルの datasource に置く。
 * モノレポではルート .env を優先し、パッケージローカル .env もフォールバックで読む。
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// リポジトリルートの .env（開発時の正）
config({ path: resolve(__dirname, '../../.env') });
// packages/database/.env があれば上書き・補完
config();

const databaseUrl =
  process.env.DATABASE_URL ??
  (process.env.CI ? 'postgresql://ci:ci@localhost:5432/market_platform_ci' : undefined);

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required in non-CI environments');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Phase 2: 代表銘柄（US/JP）を投入する
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // CI ではダミー値を許容し、ローカル/本番では明示設定を必須にする
    url: databaseUrl,
  },
});
