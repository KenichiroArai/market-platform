/**
 * Prisma Portfolio / PortfolioHolding 行を共有 DTO に変換し、評価額を付与するヘルパー。
 *
 * 最新日足終値がない保有は marketPrice / marketValue / unrealizedPnl を null にする。
 * 通貨別集計は価格がある保有のみ market 側を合算し、cost は全保有を合算する。
 */
import {
  createPortfolioCurrencyTotalDto,
  createPortfolioDto,
  createPortfolioHoldingDto,
  type PortfolioCurrencyTotalDto,
  type PortfolioDto,
  type PortfolioHoldingDto,
} from '@market/shared-types';
import { toSymbolDto, type SymbolRow } from '../market-data/market-data.mapper';

/** Prisma PortfolioHolding + Symbol の最小形。 */
export type PortfolioHoldingRow = {
  id: string;
  portfolioId: string;
  symbolId: string;
  quantity: { toString(): string } | number | string;
  averageCost: { toString(): string } | number | string;
  createdAt: Date;
  updatedAt: Date;
  symbol: SymbolRow;
};

/** Prisma Portfolio + holdings の最小形。 */
export type PortfolioRow = {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  holdings: PortfolioHoldingRow[];
};

/** Decimal 互換値を number にする。 */
function toNumber(value: { toString(): string } | number | string): number {
  if (typeof value === 'number') {
    return value;
  }
  return Number(value.toString());
}

/**
 * 保有行と最新終値（なければ null）から PortfolioHoldingDto を作る。
 */
export function toPortfolioHoldingDto(
  row: PortfolioHoldingRow,
  marketPrice: number | null,
): PortfolioHoldingDto {
  const quantity = toNumber(row.quantity);
  const averageCost = toNumber(row.averageCost);
  const costBasis = quantity * averageCost;
  const marketValue = marketPrice === null ? null : quantity * marketPrice;
  const unrealizedPnl = marketValue === null ? null : marketValue - costBasis;

  return createPortfolioHoldingDto({
    id: row.id,
    portfolioId: row.portfolioId,
    symbolId: row.symbolId,
    symbol: toSymbolDto(row.symbol),
    quantity,
    averageCost,
    costBasis,
    marketPrice,
    marketValue,
    unrealizedPnl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/**
 * 保有 DTO 群から通貨別合計を組み立てる。
 * totalCost は全保有、totalMarketValue / unrealizedPnl は価格がある保有のみ。
 */
export function buildTotalsByCurrency(
  holdings: PortfolioHoldingDto[],
): PortfolioCurrencyTotalDto[] {
  const map = new Map<
    string,
    { totalCost: number; totalMarketValue: number; unrealizedPnl: number }
  >();

  for (const holding of holdings) {
    const currency = holding.symbol.currency;
    const current = map.get(currency) ?? {
      totalCost: 0,
      totalMarketValue: 0,
      unrealizedPnl: 0,
    };
    current.totalCost += holding.costBasis;
    if (holding.marketValue !== null && holding.unrealizedPnl !== null) {
      current.totalMarketValue += holding.marketValue;
      current.unrealizedPnl += holding.unrealizedPnl;
    }
    map.set(currency, current);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, totals]) =>
      createPortfolioCurrencyTotalDto({
        currency,
        totalCost: totals.totalCost,
        totalMarketValue: totals.totalMarketValue,
        unrealizedPnl: totals.unrealizedPnl,
      }),
    );
}

/** Portfolio 行と symbolId→最新終値マップから DTO を組み立てる。 */
export function toPortfolioDto(
  row: PortfolioRow,
  latestCloseBySymbolId: Map<string, number>,
): PortfolioDto {
  const holdings = row.holdings.map((holding) =>
    toPortfolioHoldingDto(holding, latestCloseBySymbolId.get(holding.symbolId) ?? null),
  );

  return createPortfolioDto({
    id: row.id,
    userId: row.userId,
    name: row.name,
    holdings,
    totalsByCurrency: buildTotalsByCurrency(holdings),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
