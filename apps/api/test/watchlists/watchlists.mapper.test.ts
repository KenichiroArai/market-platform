import { toWatchlistDto, toWatchlistItemDto } from '../../src/watchlists/watchlists.mapper';

describe('watchlists.mapper', () => {
  const symbol = {
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

  const item = {
    id: 'item_1',
    watchlistId: 'wl_1',
    symbolId: 'sym_1',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    symbol,
  };

  it('maps item and watchlist rows', () => {
    expect(toWatchlistItemDto(item)).toEqual(
      expect.objectContaining({
        id: 'item_1',
        symbol: expect.objectContaining({ ticker: 'AAPL' }),
      }),
    );

    const dto = toWatchlistDto({
      id: 'wl_1',
      userId: 'user_1',
      name: 'Tech',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      items: [item],
    });
    expect(dto.items).toHaveLength(1);
    expect(dto.name).toBe('Tech');
  });
});
