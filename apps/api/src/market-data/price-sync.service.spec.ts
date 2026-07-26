import { PrismaService } from '../prisma.service';
import type { MarketDataProvider } from './providers/market-data.provider';
import { PriceSyncService, resolveLookbackDays } from './price-sync.service';

describe('PriceSyncService', () => {
  const symbolDelegate = { findMany: jest.fn() };
  const dailyPriceDelegate = { upsert: jest.fn() };
  const prismaService = {
    prisma: {
      symbol: symbolDelegate,
      dailyPrice: dailyPriceDelegate,
    },
  } as unknown as PrismaService;

  const provider: MarketDataProvider = {
    fetchDailyBars: jest.fn(),
  };

  let service: PriceSyncService;
  const originalLookback = process.env.MARKET_DATA_LOOKBACK_DAYS;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MARKET_DATA_LOOKBACK_DAYS;
    service = new PriceSyncService(prismaService, provider);
  });

  afterEach(() => {
    if (originalLookback === undefined) {
      delete process.env.MARKET_DATA_LOOKBACK_DAYS;
    } else {
      process.env.MARKET_DATA_LOOKBACK_DAYS = originalLookback;
    }
  });

  it('upserts bars for active symbols', async () => {
    symbolDelegate.findMany.mockResolvedValue([
      { id: 's1', ticker: 'AAPL', market: 'US' },
    ]);
    (provider.fetchDailyBars as jest.Mock).mockResolvedValue([
      {
        date: '2026-01-02',
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 100.7,
      },
    ]);
    dailyPriceDelegate.upsert.mockResolvedValue({});

    const result = await service.syncPrices({
      from: '2026-01-01',
      to: '2026-01-03',
    });

    expect(result).toEqual({
      processedSymbols: 1,
      upsertedBars: 1,
      failures: [],
    });
    expect(dailyPriceDelegate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ volume: 100n }),
      }),
    );
  });

  it('filters by symbolIds when provided', async () => {
    symbolDelegate.findMany.mockResolvedValue([]);
    await service.syncPrices({ symbolIds: ['s1', 's2'] });
    expect(symbolDelegate.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['s1', 's2'] } },
      orderBy: [{ market: 'asc' }, { ticker: 'asc' }],
    });
  });

  it('records per-symbol failures without aborting', async () => {
    symbolDelegate.findMany.mockResolvedValue([
      { id: 's1', ticker: 'AAPL', market: 'US' },
      { id: 's2', ticker: 'MSFT', market: 'US' },
    ]);
    (provider.fetchDailyBars as jest.Mock)
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce('boom');
    dailyPriceDelegate.upsert.mockResolvedValue({});

    const result = await service.syncPrices({ from: '2026-01-01', to: '2026-01-01' });
    expect(result.processedSymbols).toBe(2);
    expect(result.upsertedBars).toBe(0);
    expect(result.failures).toEqual([
      { symbolId: 's1', ticker: 'AAPL', reason: 'network' },
      { symbolId: 's2', ticker: 'MSFT', reason: 'Unknown provider error' },
    ]);
  });

  it('uses lookback defaults when from/to omitted', async () => {
    symbolDelegate.findMany.mockResolvedValue([]);
    await service.syncPrices();
    expect(symbolDelegate.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ market: 'asc' }, { ticker: 'asc' }],
    });
  });
});

describe('resolveLookbackDays', () => {
  it('parses positive integers and falls back otherwise', () => {
    expect(resolveLookbackDays(undefined)).toBe(30);
    expect(resolveLookbackDays('14')).toBe(14);
    expect(resolveLookbackDays('0')).toBe(30);
    expect(resolveLookbackDays('-1')).toBe(30);
    expect(resolveLookbackDays('abc')).toBe(30);
  });
});
