import { PrismaService } from '../../src/prisma.service';
import type { MarketDataProvider } from '../../src/market-data/providers/market-data.provider';
import {
  PriceSyncService,
  resolveFetchRanges,
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

  it('skips provider when stored min/max already cover the requested range', async () => {
    symbolDelegate.findMany.mockResolvedValue([
      { id: 's1', ticker: 'AAPL', market: 'US' },
    ]);
    dailyPriceDelegate.aggregate.mockResolvedValue({
      _min: { date: new Date('2026-01-01T00:00:00.000Z') },
      _max: { date: new Date('2026-01-31T00:00:00.000Z') },
    });

    const result = await service.syncPrices({
      from: '2026-01-10',
      to: '2026-01-20',
    });

    expect(result.upsertedBars).toBe(0);
    expect(provider.fetchDailyBars).not.toHaveBeenCalled();
  });

  it('fetches only before min and after max when both gaps exist', async () => {
    symbolDelegate.findMany.mockResolvedValue([
      { id: 's1', ticker: 'AAPL', market: 'US' },
    ]);
    dailyPriceDelegate.aggregate.mockResolvedValue({
      _min: { date: new Date('2026-01-10T00:00:00.000Z') },
      _max: { date: new Date('2026-01-20T00:00:00.000Z') },
    });
    (provider.fetchDailyBars as jest.Mock)
      .mockResolvedValueOnce([
        {
          date: '2026-01-01',
          open: 1,
          high: 1,
          low: 1,
          close: 1,
          volume: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          date: '2026-01-21',
          open: 2,
          high: 2,
          low: 2,
          close: 2,
          volume: 2,
        },
      ]);
    dailyPriceDelegate.upsert.mockResolvedValue({});

    const result = await service.syncPrices({
      from: '2026-01-01',
      to: '2026-01-31',
    });

    expect(provider.fetchDailyBars).toHaveBeenNthCalledWith(
      1,
      'AAPL',
      '2026-01-01',
      '2026-01-09',
    );
    expect(provider.fetchDailyBars).toHaveBeenNthCalledWith(
      2,
      'AAPL',
      '2026-01-21',
      '2026-01-31',
    );
    expect(result.upsertedBars).toBe(2);
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
  it('returns the full window when nothing is stored', () => {
    expect(resolveFetchRanges('2026-01-01', '2026-01-31', null, null)).toEqual([
      { from: '2026-01-01', to: '2026-01-31' },
    ]);
    expect(resolveFetchRanges('2026-01-01', '2026-01-31', '2026-01-10', null)).toEqual([
      { from: '2026-01-01', to: '2026-01-31' },
    ]);
  });

  it('returns only the range before stored min', () => {
    expect(resolveFetchRanges('2026-01-01', '2026-01-15', '2026-01-10', '2026-01-20')).toEqual([
      { from: '2026-01-01', to: '2026-01-09' },
    ]);
  });

  it('returns only the range after stored max', () => {
    expect(resolveFetchRanges('2026-01-12', '2026-01-31', '2026-01-10', '2026-01-20')).toEqual([
      { from: '2026-01-21', to: '2026-01-31' },
    ]);
  });

  it('returns both sides when the request surrounds stored min/max', () => {
    expect(resolveFetchRanges('2026-01-01', '2026-01-31', '2026-01-10', '2026-01-20')).toEqual([
      { from: '2026-01-01', to: '2026-01-09' },
      { from: '2026-01-21', to: '2026-01-31' },
    ]);
  });

  it('returns empty when the request is fully covered', () => {
    expect(resolveFetchRanges('2026-01-10', '2026-01-20', '2026-01-01', '2026-01-31')).toEqual([]);
  });

  it('returns empty when requested from is after to', () => {
    expect(resolveFetchRanges('2026-02-01', '2026-01-01', null, null)).toEqual([]);
  });

  it('drops inverted gap edges around stored min/max', () => {
    expect(resolveFetchRanges('2026-01-00', '2026-01-15', '2026-01-01', '2026-01-20')).toEqual([]);
    expect(resolveFetchRanges('2026-01-12', '2026-01-32', '2026-01-10', '2026-01-31')).toEqual([]);
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
