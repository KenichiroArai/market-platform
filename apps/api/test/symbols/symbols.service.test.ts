import { ConflictException, NotFoundException } from '@nestjs/common';
import { API_ERROR_CODES } from '@market/shared-types';
import { PriceSyncService } from '../../src/market-data/price-sync.service';
import type { MarketDataProvider } from '../../src/market-data/providers/market-data.provider';
import { PrismaService } from '../../src/prisma.service';
import { normalizeTicker, SymbolsService } from '../../src/symbols/symbols.service';

describe('SymbolsService', () => {
  const symbolDelegate = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const prismaService = {
    prisma: { symbol: symbolDelegate },
  } as unknown as PrismaService;
  const priceSyncService = {
    syncPrices: jest.fn(),
  } as unknown as PriceSyncService;
  const provider: MarketDataProvider = {
    fetchDailyBars: jest.fn(),
    fetchQuote: jest.fn(),
  };

  let service: SymbolsService;

  const row = {
    id: 's1',
    ticker: 'AAPL',
    market: 'US' as const,
    name: 'Apple',
    currency: 'USD',
    exchange: 'NASDAQ',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (priceSyncService.syncPrices as jest.Mock).mockResolvedValue({
      processedSymbols: 1,
      upsertedBars: 0,
      failures: [],
    });
    service = new SymbolsService(prismaService, priceSyncService, provider);
  });

  it('lists symbols with filters', async () => {
    symbolDelegate.findMany.mockResolvedValue([row]);
    const result = await service.list({ market: 'US', isActive: true });
    expect(result[0]?.ticker).toBe('AAPL');
    expect(symbolDelegate.findMany).toHaveBeenCalledWith({
      where: { market: 'US', isActive: true },
      orderBy: [{ market: 'asc' }, { ticker: 'asc' }],
    });
  });

  it('gets by id', async () => {
    symbolDelegate.findUnique.mockResolvedValue(row);
    await expect(service.getById('s1')).resolves.toEqual(
      expect.objectContaining({ id: 's1', ticker: 'AAPL' }),
    );
  });

  it('throws when symbol is missing', async () => {
    symbolDelegate.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a symbol from quote metadata and syncs prices', async () => {
    symbolDelegate.findUnique.mockResolvedValue(null);
    (provider.fetchQuote as jest.Mock).mockResolvedValue({
      name: 'Apple Inc.',
      currency: 'USD',
      exchange: 'NASDAQ',
    });
    symbolDelegate.create.mockResolvedValue({ ...row, name: 'Apple Inc.' });

    await expect(service.create({ ticker: 'aapl', market: 'US' })).resolves.toEqual(
      expect.objectContaining({ ticker: 'AAPL', name: 'Apple Inc.' }),
    );
    expect(provider.fetchQuote).toHaveBeenCalledWith('AAPL');
    expect(symbolDelegate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticker: 'AAPL',
        name: 'Apple Inc.',
        currency: 'USD',
        exchange: 'NASDAQ',
        isActive: true,
      }),
    });
    expect(priceSyncService.syncPrices).toHaveBeenCalledWith({ symbolIds: ['s1'] });
  });

  it('normalizes JP tickers and keeps existing .T suffix', async () => {
    symbolDelegate.findUnique.mockResolvedValue(null);
    (provider.fetchQuote as jest.Mock).mockResolvedValue({
      name: 'Toyota',
      currency: 'JPY',
      exchange: 'TSE',
    });
    symbolDelegate.create.mockResolvedValue({
      ...row,
      ticker: '7203.T',
      market: 'JP',
      name: 'Toyota',
      currency: 'JPY',
      exchange: 'TSE',
    });

    await service.create({ ticker: '7203', market: 'JP' });
    expect(provider.fetchQuote).toHaveBeenCalledWith('7203.T');

    await service.create({ ticker: '7203.T', market: 'JP' });
    expect(provider.fetchQuote).toHaveBeenLastCalledWith('7203.T');
  });

  it('rejects duplicate ticker+market before quote', async () => {
    symbolDelegate.findUnique.mockResolvedValue(row);
    try {
      await service.create({ ticker: 'AAPL', market: 'US' });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ code: API_ERROR_CODES.SYMBOL_ALREADY_EXISTS }),
      );
    }
    expect(provider.fetchQuote).not.toHaveBeenCalled();
  });

  it('rejects when quote is missing', async () => {
    symbolDelegate.findUnique.mockResolvedValue(null);
    (provider.fetchQuote as jest.Mock).mockRejectedValue(new Error('not found'));
    try {
      await service.create({ ticker: 'NOPE', market: 'US' });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual(
        expect.objectContaining({ code: API_ERROR_CODES.SYMBOL_QUOTE_NOT_FOUND }),
      );
    }
    expect(symbolDelegate.create).not.toHaveBeenCalled();
  });

  it('keeps the symbol when initial price sync fails', async () => {
    symbolDelegate.findUnique.mockResolvedValue(null);
    (provider.fetchQuote as jest.Mock).mockResolvedValue({
      name: 'Apple',
      currency: 'USD',
      exchange: null,
    });
    symbolDelegate.create.mockResolvedValue(row);
    (priceSyncService.syncPrices as jest.Mock)
      .mockRejectedValueOnce(new Error('yahoo down'))
      .mockRejectedValueOnce('boom');

    await expect(service.create({ ticker: 'AAPL', market: 'US' })).resolves.toEqual(
      expect.objectContaining({ id: 's1' }),
    );
    await expect(service.create({ ticker: 'AAPL', market: 'US' })).resolves.toEqual(
      expect.objectContaining({ id: 's1' }),
    );
  });

  it('updates a symbol', async () => {
    symbolDelegate.findUnique.mockResolvedValue(row);
    symbolDelegate.update.mockResolvedValue({ ...row, name: 'Apple Inc.' });
    await expect(
      service.update('s1', { name: 'Apple Inc.', isActive: false }),
    ).resolves.toEqual(expect.objectContaining({ name: 'Apple Inc.' }));
  });
});

describe('normalizeTicker', () => {
  it('uppercases and appends .T for JP when missing', () => {
    expect(normalizeTicker(' aapl ', 'US')).toBe('AAPL');
    expect(normalizeTicker('7203', 'JP')).toBe('7203.T');
    expect(normalizeTicker('7203.t', 'JP')).toBe('7203.T');
  });
});
