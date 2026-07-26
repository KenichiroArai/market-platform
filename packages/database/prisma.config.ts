/**
 * Prisma CLI（migrate / generate 等）向けの設定。
 *
 * v7 では接続 URL を schema.prisma ではなくこのファイルの datasource に置く。
 * モノレポではルート .env を優先し、パッケージローカル .env もフォールバックで読む。
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig, env } from 'prisma/config';

// リポジトリルートの .env（開発時の正）
config({ path: resolve(__dirname, '../../.env') });
// packages/database/.env があれば上書き・補完
config();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Phase 2: 代表銘柄（US/JP）を投入する
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // prisma migrate / generate 実行時に必須
    url: env('DATABASE_URL'),
  },
});
