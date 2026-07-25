/**
 * Prisma Client の生成入口。
 *
 * Prisma 7 では Driver Adapter（ここでは PostgreSQL 用 PrismaPg）が必須のため、
 * 接続文字列からアダプタを組み立てて Client を返す。
 * 生成物（../generated）は `prisma generate` の成果物であり、手編集しない。
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';

/** 型だけ再エクスポートし、アプリ側は値としての PrismaClient を直接 new しない。 */
export type { PrismaClient } from '../generated/client';

/**
 * PrismaClient を生成する。
 *
 * @param connectionString - 省略時は process.env.DATABASE_URL を使う
 * @throws DATABASE_URL も引数も無い場合
 */
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  // 接続先が無いとアダプタ初期化や初回クエリで分かりにくいエラーになるため、ここで明示する
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
