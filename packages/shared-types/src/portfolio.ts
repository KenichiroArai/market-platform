/**
 * ポートフォリオ API の共有 DTO。
 *
 * 保有は quantity + averageCost。評価額・含み損益は最新日足終値から算出し、
 * 通貨が混在しうるため totalsByCurrency で通貨別に集計する。
 */

import { isSymbolDto, type SymbolDto } from './market';

/** 通貨別の集計行。異なる通貨を単一合計に混ぜない。 */
export interface PortfolioCurrencyTotalDto {
  currency: string;
  totalCost: number;
  totalMarketValue: number;
  unrealizedPnl: number;
}

/**
 * 保有 1 行。価格未取得の場合 marketPrice / marketValue / unrealizedPnl は null。
 * costBasis は常に quantity * averageCost。
 */
export interface PortfolioHoldingDto {
  id: string;
  portfolioId: string;
  symbolId: string;
  symbol: SymbolDto;
  quantity: number;
  averageCost: number;
  costBasis: number;
  marketPrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  createdAt: string;
  updatedAt: string;
}

/** ポートフォリオ本体。詳細取得時は holdings と通貨別集計を含む。 */
export interface PortfolioDto {
  id: string;
  userId: string;
  name: string;
  holdings: PortfolioHoldingDto[];
  totalsByCurrency: PortfolioCurrencyTotalDto[];
  createdAt: string;
  updatedAt: string;
}

/** ポートフォリオ作成リクエスト。 */
export interface CreatePortfolioRequest {
  name: string;
}

/** ポートフォリオ更新リクエスト（部分更新）。 */
export interface UpdatePortfolioRequest {
  name?: string;
}

/** 保有追加リクエスト。 */
export interface AddPortfolioHoldingRequest {
  symbolId: string;
  quantity: number;
  averageCost: number;
}

/** 保有更新リクエスト（部分更新）。 */
export interface UpdatePortfolioHoldingRequest {
  quantity?: number;
  averageCost?: number;
}

/** PortfolioCurrencyTotalDto を組み立てるファクトリ。 */
export function createPortfolioCurrencyTotalDto(
  input: PortfolioCurrencyTotalDto,
): PortfolioCurrencyTotalDto {
  return {
    currency: input.currency,
    totalCost: input.totalCost,
    totalMarketValue: input.totalMarketValue,
    unrealizedPnl: input.unrealizedPnl,
  };
}

/** PortfolioHoldingDto を組み立てるファクトリ。 */
export function createPortfolioHoldingDto(input: PortfolioHoldingDto): PortfolioHoldingDto {
  return {
    id: input.id,
    portfolioId: input.portfolioId,
    symbolId: input.symbolId,
    symbol: input.symbol,
    quantity: input.quantity,
    averageCost: input.averageCost,
    costBasis: input.costBasis,
    marketPrice: input.marketPrice,
    marketValue: input.marketValue,
    unrealizedPnl: input.unrealizedPnl,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

/** PortfolioDto を組み立てるファクトリ。 */
export function createPortfolioDto(input: PortfolioDto): PortfolioDto {
  return {
    id: input.id,
    userId: input.userId,
    name: input.name,
    holdings: input.holdings,
    totalsByCurrency: input.totalsByCurrency,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

/** 未知の JSON が PortfolioCurrencyTotalDto として妥当かを判定する。 */
export function isPortfolioCurrencyTotalDto(
  value: unknown,
): value is PortfolioCurrencyTotalDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.currency === 'string' &&
    typeof record.totalCost === 'number' &&
    typeof record.totalMarketValue === 'number' &&
    typeof record.unrealizedPnl === 'number'
  );
}

/** 未知の JSON が PortfolioHoldingDto として妥当かを判定する。 */
export function isPortfolioHoldingDto(value: unknown): value is PortfolioHoldingDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.portfolioId === 'string' &&
    typeof record.symbolId === 'string' &&
    isSymbolDto(record.symbol) &&
    typeof record.quantity === 'number' &&
    typeof record.averageCost === 'number' &&
    typeof record.costBasis === 'number' &&
    (record.marketPrice === null || typeof record.marketPrice === 'number') &&
    (record.marketValue === null || typeof record.marketValue === 'number') &&
    (record.unrealizedPnl === null || typeof record.unrealizedPnl === 'number') &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
}

/** 未知の JSON が PortfolioDto として妥当かを判定する。 */
export function isPortfolioDto(value: unknown): value is PortfolioDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.userId !== 'string' ||
    typeof record.name !== 'string' ||
    !Array.isArray(record.holdings) ||
    !Array.isArray(record.totalsByCurrency) ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    return false;
  }

  return (
    record.holdings.every((item) => isPortfolioHoldingDto(item)) &&
    record.totalsByCurrency.every((item) => isPortfolioCurrencyTotalDto(item))
  );
}
