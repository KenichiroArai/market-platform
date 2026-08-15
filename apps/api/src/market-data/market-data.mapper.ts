/**
 * Prisma Symbol / DailyPrice 行を共有 DTO に変換するヘルパー。
 *
 * Decimal / BigInt / Date を JSON 向きの number / string に正規化する。
 */
import {
  createDailyPriceDto,
  createSymbolDto,
  type DailyPriceDto,
  type SymbolDto,
} from '@market/shared-types';

/** Prisma Symbol 行の最小形。 */
export type SymbolRow = {
  id: string;
  ticker: string;
  market: 'US' | 'JP';
  name: string;
  currency: string;
  exchange: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Prisma DailyPrice 行の最小形。 */
export type DailyPriceRow = {
  id: string;
  symbolId: string;
  date: Date;
  open: { toString(): string } | number | string;
  high: { toString(): string } | number | string;
  low: { toString(): string } | number | string;
  close: { toString(): string } | number | string;
  volume: bigint | number;
  createdAt: Date;
  updatedAt: Date;
};

/** Symbol 行を SymbolDto に変換する。 */
export function toSymbolDto(row: SymbolRow): SymbolDto {
  return createSymbolDto({
    id: row.id,
    ticker: row.ticker,
    market: row.market,
    name: row.name,
    currency: row.currency,
    exchange: row.exchange,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/** DailyPrice 行を DailyPriceDto に変換する。 */
export function toDailyPriceDto(row: DailyPriceRow): DailyPriceDto {
  return createDailyPriceDto({
    id: row.id,
    symbolId: row.symbolId,
    date: row.date.toISOString().slice(0, 10),
    open: toNumber(row.open),
    high: toNumber(row.high),
    low: toNumber(row.low),
    close: toNumber(row.close),
    volume: typeof row.volume === 'bigint' ? Number(row.volume) : row.volume,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/** Decimal 互換値を number にする。 */
function toNumber(value: { toString(): string } | number | string): number {
  if (typeof value === 'number') {
    return value;
  }
  return Number(value.toString());
}

/** YYYY-MM-DD を UTC 日付（Date @db.Date）に変換する。 */
export function parseDateOnly(value: string): Date {
  const parts = value.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Date を YYYY-MM-DD にする。 */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 今日（UTC）から lookbackDays 日前の YYYY-MM-DD を返す。
 * ジョブ既定の取得期間に使う。
 */
export function lookbackFromDate(lookbackDays: number, now = new Date()): string {
  const date = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  date.setUTCDate(date.getUTCDate() - lookbackDays);
  return formatDateOnly(date);
}

/** 今日（UTC）の YYYY-MM-DD。 */
export function todayDateOnly(now = new Date()): string {
  return formatDateOnly(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  );
}

/**
 * YYYY-MM-DD に日数を足す（負なら戻す）。
 * 差分同期で min-1 / max+1 を計算するために使う。
 */
export function addDays(dateOnly: string, days: number): string {
  const date = parseDateOnly(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}
