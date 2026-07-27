import {
  buildTotalsByCurrency,
  toPortfolioDto,
  toPortfolioHoldingDto,
} from './portfolios.mapper';

describe('portfolios.mapper', () => {
  const symbolUsd = {
    id: 'sym_1',
    ticker: 'AAPL',
    market: 'US' as const,
    name: 'Apple',
    currency: 'USD',
    exchange: 'NASDAQ',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const symbolJpy = {
    ...symbolUsd,
    id: 'sym_2',
    ticker: '7203.T',
    market: 'JP' as const,
    name: 'Toyota',
    currency: 'JPY',
    exchange: 'TSE',
  };

  const holdingUsd = {
    id: 'h_1',
    portfolioId: 'pf_1',
    symbolId: 'sym_1',
    quantity: 10,
    averageCost: { toString: () => '100' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    symbol: symbolUsd,
  };

  const holdingJpy = {
    id: 'h_2',
    portfolioId: 'pf_1',
    symbolId: 'sym_2',
    quantity: '5',
    averageCost: 2000,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    symbol: symbolJpy,
  };

  it('maps holding with and without market price', () => {
    const priced = toPortfolioHoldingDto(holdingUsd, 110);
    expect(priced.costBasis).toBe(1000);
    expect(priced.marketValue).toBe(1100);
    expect(priced.unrealizedPnl).toBe(100);

    const unpriced = toPortfolioHoldingDto(holdingUsd, null);
    expect(unpriced.marketPrice).toBeNull();
    expect(unpriced.marketValue).toBeNull();
    expect(unpriced.unrealizedPnl).toBeNull();
  });

  it('builds totals by currency and portfolio dto', () => {
    const prices = new Map<string, number>([
      ['sym_1', 110],
      // sym_2 has no price
    ]);
    const dto = toPortfolioDto(
      {
        id: 'pf_1',
        userId: 'user_1',
        name: 'Core',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        holdings: [holdingUsd, holdingJpy],
      },
      prices,
    );

    expect(dto.holdings).toHaveLength(2);
    expect(dto.totalsByCurrency).toEqual([
      {
        currency: 'JPY',
        totalCost: 10000,
        totalMarketValue: 0,
        unrealizedPnl: 0,
      },
      {
        currency: 'USD',
        totalCost: 1000,
        totalMarketValue: 1100,
        unrealizedPnl: 100,
      },
    ]);

    expect(buildTotalsByCurrency([])).toEqual([]);
  });
});
