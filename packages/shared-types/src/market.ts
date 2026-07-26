/**
 * 市場データ API の共有 DTO。
 *
 * 銘柄マスタ・日足価格・価格同期ジョブの契約を NestJS / Next.js で共有する。
 * OHLC の数値は JSON では number（または文字列化した Decimal）として扱う。
 */

/** 上場市場。Prisma Market enum と値を揃える。 */
export type Market = 'US' | 'JP';

/** 銘柄マスタの応答。 */
export interface SymbolDto {
  id: string;
  ticker: string;
  market: Market;
  name: string;
  currency: string;
  exchange: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 銘柄作成リクエスト。 */
export interface CreateSymbolRequest {
  ticker: string;
  market: Market;
  name: string;
  currency: string;
  exchange?: string | null;
  isActive?: boolean;
}

/** 銘柄更新リクエスト（部分更新）。 */
export interface UpdateSymbolRequest {
  name?: string;
  currency?: string;
  exchange?: string | null;
  isActive?: boolean;
}

/** 日足 OHLC の応答。数値が Decimal 由来でも JSON では number にする。 */
export interface DailyPriceDto {
  id: string;
  symbolId: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  createdAt: string;
  updatedAt: string;
}

/** 価格同期ジョブで失敗した銘柄の要約。 */
export interface PriceSyncFailure {
  symbolId: string;
  ticker: string;
  reason: string;
}

/**
 * 価格同期ジョブの結果。
 * 1 銘柄の失敗で全体を落とさず、failures に積む。
 */
export interface PriceSyncJobResult {
  processedSymbols: number;
  upsertedBars: number;
  failures: PriceSyncFailure[];
}

/** Market として妥当かを判定する。 */
export function isMarket(value: unknown): value is Market {
  return value === 'US' || value === 'JP';
}

/** SymbolDto を組み立てるファクトリ（ISO 文字列の正規化用）。 */
export function createSymbolDto(input: SymbolDto): SymbolDto {
  return {
    id: input.id,
    ticker: input.ticker,
    market: input.market,
    name: input.name,
    currency: input.currency,
    exchange: input.exchange,
    isActive: input.isActive,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

/** DailyPriceDto を組み立てるファクトリ。 */
export function createDailyPriceDto(input: DailyPriceDto): DailyPriceDto {
  return {
    id: input.id,
    symbolId: input.symbolId,
    date: input.date,
    open: input.open,
    high: input.high,
    low: input.low,
    close: input.close,
    volume: input.volume,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

/** PriceSyncJobResult を組み立てるファクトリ。 */
export function createPriceSyncJobResult(
  processedSymbols: number,
  upsertedBars: number,
  failures: PriceSyncFailure[] = [],
): PriceSyncJobResult {
  return {
    processedSymbols,
    upsertedBars,
    failures,
  };
}

/** 未知の JSON が SymbolDto として妥当かを判定する。 */
export function isSymbolDto(value: unknown): value is SymbolDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.ticker === 'string' &&
    isMarket(record.market) &&
    typeof record.name === 'string' &&
    typeof record.currency === 'string' &&
    (record.exchange === null || typeof record.exchange === 'string') &&
    typeof record.isActive === 'boolean' &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
}

/** 未知の JSON が DailyPriceDto として妥当かを判定する。 */
export function isDailyPriceDto(value: unknown): value is DailyPriceDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.symbolId === 'string' &&
    typeof record.date === 'string' &&
    typeof record.open === 'number' &&
    typeof record.high === 'number' &&
    typeof record.low === 'number' &&
    typeof record.close === 'number' &&
    typeof record.volume === 'number' &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
}

/** 未知の JSON が PriceSyncJobResult として妥当かを判定する。 */
export function isPriceSyncJobResult(value: unknown): value is PriceSyncJobResult {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.processedSymbols !== 'number' ||
    typeof record.upsertedBars !== 'number' ||
    !Array.isArray(record.failures)
  ) {
    return false;
  }

  return record.failures.every((item) => {
    if (item === null || typeof item !== 'object') {
      return false;
    }
    const failure = item as Record<string, unknown>;
    return (
      typeof failure.symbolId === 'string' &&
      typeof failure.ticker === 'string' &&
      typeof failure.reason === 'string'
    );
  });
}
