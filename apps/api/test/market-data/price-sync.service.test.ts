import { PrismaService } from '../../src/prisma.service';
import type { MarketDataProvider } from '../../src/market-data/providers/market-data.provider';
import {
  PriceSyncService,
  mergeFetchRanges,
  resolveFetchRanges,
  resolveFetchRangesWithRefresh,
  resolveLookbackDays,
} from '../../src/market-data/price-sync.service';

describe('PriceSyncService', () => {
  const symbolDelegate = { findMany: jest.fn() };
  const dailyPriceDelegate = { upsert: jest.fn(), aggregate: jest.fn() };
  const prismaService = {
    prisma: {
      symbol: symbolDelegate,
      dailyPrice: dailyPriceDelegate,
    },
  } as unknown as PrismaService;

  const provider: MarketDataProvider = {
    fetchDailyBars: jest.fn(),
    fetchQuote: jest.fn(),
  };

  let service: PriceSyncService;
  const originalLookback = process.env.MARKET_DATA_LOOKBACK_DAYS;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MARKET_DATA_LOOKBACK_DAYS;
    dailyPriceDelegate.aggregate.mockResolvedValue({
      _min: { date: null },
      _max: { date: null },
    });
    service = new PriceSyncService(prismaService, provider);
  });

  afterEach(() => {
    if (originalLookback === undefined) {
      delete process.env.MARKET_DATA_LOOKBACK_DAYS;
    } else {
      process.env.MARKET_DATA_LOOKBACK_DAYS = originalLookback;
    }
  });

  it('upserts bars for active symbols when no stored prices exist', async () => {
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
    expect(provider.fetchDailyBars).toHaveBeenCalledWith('AAPL', '2026-01-01', '2026-01-03');
    expect(dailyPriceDelegate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ volume: 100n }),
      }),
    );
  });

  it('refreshes trailing lookback even when stored range covers request', async () => {
    symbolDelegate.findMany.mockResolvedValue([
      { id: 's1', ticker: '7203.T', market: 'JP' },
    ]);
    dailyPriceDelegate.aggregate.mockResolvedValue({
      _min: { date: new Date('2025-08-01T00:00:00.000Z') },
      _max: { date: new Date('2026-09-30T00:00:00.000Z') },
    });
    (provider.fetchDailyBars as jest.Mock).mockResolvedValue([
      {
        date: '2026-08-28',
        open: 3090,
        high: 3145,
        low: 3080,
        close: 3116,
        volume: 24_831_800,
      },
    ]);
    dailyPriceDelegate.upsert.mockResolvedValue({});

    const result = await service.syncPrices({
      from: '2026-08-01',
      to: '2026-08-28',
    });

    expect(result.upsertedBars).toBe(1);
    expect(provider.fetchDailyBars).toHaveBeenCalledWith('7203.T', '2026-08-01', '2026-08-28');
  });

  it('forceRefresh re-fetches the entire requested range', async () => {
    symbolDelegate.findMany.mockResolvedValue([
      { id: 's1', ticker: '7203.T', market: 'JP' },
    ]);
    (provider.fetchDailyBars as jest.Mock).mockResolvedValue([
      {
        date: '2026-08-28',
        open: 3090,
        high: 3145,
        low: 3080,
        close: 3116,
        volume: 24_831_800,
      },
    ]);
    dailyPriceDelegate.upsert.mockResolvedValue({});

    const result = await service.syncPrices({
      from: '2025-08-01',
      to: '2026-09-30',
      forceRefresh: true,
    });

    expect(dailyPriceDelegate.aggregate).not.toHaveBeenCalled();
    expect(provider.fetchDailyBars).toHaveBeenCalledWith('7203.T', '2025-08-01', '2026-09-30');
    expect(result.upsertedBars).toBe(1);
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

describe('resolveFetchRanges', () => {
  it('covers empty stored and gap edges', () => {
    expect(resolveFetchRanges('2026-01-01', '2026-01-31', null, null)).toEqual([
      { from: '2026-01-01', to: '2026-01-31' },
    ]);
    expect(resolveFetchRanges('2026-01-10', '2026-01-20', '2026-01-01', '2026-01-31')).toEqual([]);
  });
});

describe('resolveFetchRangesWithRefresh', () => {
  it('adds trailing refresh when gaps are empty', () => {
    expect(
      resolveFetchRangesWithRefresh(
        '2026-01-10',
        '2026-01-20',
        '2026-01-01',
        '2026-01-31',
        5,
      ),
    ).toEqual([{ from: '2026-01-16', to: '2026-01-20' }]);
  });
});

describe('mergeFetchRanges', () => {
  it('merges overlapping and adjacent ranges', () => {
    expect(
      mergeFetchRanges(
        [
          { from: '2026-01-01', to: '2026-01-05' },
          { from: '2026-01-10', to: '2026-01-12' },
        ],
        { from: '2026-01-06', to: '2026-01-11' },
      ),
    ).toEqual([{ from: '2026-01-01', to: '2026-01-12' }]);
  });
});

describe('resolveLookbackDays', () => {
  it('parses positive integers and falls back otherwise', () => {
    expect(resolveLookbackDays(undefined)).toBe(30);
    expect(resolveLookbackDays('14')).toBe(14);
    expect(resolveLookbackDays('0')).toBe(30);
  });
});
