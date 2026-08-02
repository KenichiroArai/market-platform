import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PricesService } from './prices.service';

describe('PricesService', () => {
  const symbolDelegate = { findUnique: jest.fn() };
  const dailyPriceDelegate = { findMany: jest.fn() };
  const prismaService = {
    prisma: {
      symbol: symbolDelegate,
      dailyPrice: dailyPriceDelegate,
    },
  } as unknown as PrismaService;

  let service: PricesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PricesService(prismaService);
  });

  it('lists prices for an existing symbol', async () => {
    symbolDelegate.findUnique.mockResolvedValue({ id: 's1' });
    dailyPriceDelegate.findMany.mockResolvedValue([
      {
        id: 'p1',
        symbolId: 's1',
        date: new Date('2026-01-02T00:00:00.000Z'),
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 10n,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    const result = await service.listBySymbolId('s1', {
      from: '2026-01-01',
      to: '2026-01-31',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.close).toBe(1.5);
  });

  it('lists without date range', async () => {
    symbolDelegate.findUnique.mockResolvedValue({ id: 's1' });
    dailyPriceDelegate.findMany.mockResolvedValue([]);
    await service.listBySymbolId('s1');
    expect(dailyPriceDelegate.findMany).toHaveBeenCalledWith({
      where: {
        symbolId: 's1',
        date: { gte: undefined, lte: undefined },
      },
      orderBy: { date: 'asc' },
    });
  });

  it('aggregates to weekly when interval is 1w', async () => {
    symbolDelegate.findUnique.mockResolvedValue({ id: 's1' });
    dailyPriceDelegate.findMany.mockResolvedValue([
      {
        id: 'p1',
        symbolId: 's1',
        date: new Date('2026-01-05T00:00:00.000Z'),
        open: 8,
        high: 9,
        low: 7,
        close: 8.5,
        volume: 50n,
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
        updatedAt: new Date('2026-01-05T00:00:00.000Z'),
      },
      {
        id: 'p2',
        symbolId: 's1',
        date: new Date('2026-01-09T00:00:00.000Z'),
        open: 11,
        high: 15,
        low: 10,
        close: 14,
        volume: 200n,
        createdAt: new Date('2026-01-09T00:00:00.000Z'),
        updatedAt: new Date('2026-01-09T00:00:00.000Z'),
      },
    ]);

    const result = await service.listBySymbolId('s1', { interval: '1w' });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: '2026-01-09',
      open: 8,
      high: 15,
      low: 7,
      close: 14,
      volume: 250,
    });
  });

  it('throws when symbol is missing', async () => {
    symbolDelegate.findUnique.mockResolvedValue(null);
    await expect(service.listBySymbolId('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists with lookback when from is omitted', async () => {
    symbolDelegate.findUnique.mockResolvedValue({ id: 's1' });
    dailyPriceDelegate.findMany.mockResolvedValue([
      {
        id: 'p1',
        symbolId: 's1',
        date: new Date('2026-01-02T00:00:00.000Z'),
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1n,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);

    const result = await service.listWithLookback('s1', {
      to: '2026-01-31',
      lookback: 20,
    });
    expect(result.rangeStartIndex).toBe(0);
    expect(result.bars).toHaveLength(1);
    expect(dailyPriceDelegate.findMany).toHaveBeenCalledTimes(1);
  });

  it('prepends prior bars when from is set', async () => {
    symbolDelegate.findUnique.mockResolvedValue({ id: 's1' });
    dailyPriceDelegate.findMany
      .mockResolvedValueOnce([
        {
          id: 'p0',
          symbolId: 's1',
          date: new Date('2025-12-31T00:00:00.000Z'),
          open: 1,
          high: 1,
          low: 1,
          close: 1,
          volume: 1n,
          createdAt: new Date('2025-12-31T00:00:00.000Z'),
          updatedAt: new Date('2025-12-31T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'p1',
          symbolId: 's1',
          date: new Date('2026-01-02T00:00:00.000Z'),
          open: 2,
          high: 2,
          low: 2,
          close: 2,
          volume: 1n,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ]);

    const result = await service.listWithLookback('s1', {
      from: '2026-01-01',
      to: '2026-01-31',
      lookback: 5,
    });
    expect(result.rangeStartIndex).toBe(1);
    expect(result.bars.map((b) => b.id)).toEqual(['p0', 'p1']);
  });

  it('skips prior query when lookback is 0', async () => {
    symbolDelegate.findUnique.mockResolvedValue({ id: 's1' });
    dailyPriceDelegate.findMany.mockResolvedValue([]);

    const result = await service.listWithLookback('s1', {
      from: '2026-01-01',
      lookback: 0,
    });
    expect(result.rangeStartIndex).toBe(0);
    expect(dailyPriceDelegate.findMany).toHaveBeenCalledTimes(1);
  });

  it('throws when symbol is missing for lookback', async () => {
    symbolDelegate.findUnique.mockResolvedValue(null);
    await expect(
      service.listWithLookback('missing', { lookback: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists weekly with lookback when from is omitted', async () => {
    symbolDelegate.findUnique.mockResolvedValue({ id: 's1' });
    dailyPriceDelegate.findMany.mockResolvedValue([
      {
        id: 'p1',
        symbolId: 's1',
        date: new Date('2026-01-05T00:00:00.000Z'),
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1n,
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
        updatedAt: new Date('2026-01-05T00:00:00.000Z'),
      },
      {
        id: 'p2',
        symbolId: 's1',
        date: new Date('2026-01-12T00:00:00.000Z'),
        open: 2,
        high: 2,
        low: 2,
        close: 2,
        volume: 2n,
        createdAt: new Date('2026-01-12T00:00:00.000Z'),
        updatedAt: new Date('2026-01-12T00:00:00.000Z'),
      },
    ]);

    const result = await service.listWithLookback('s1', {
      to: '2026-01-31',
      lookback: 2,
      interval: '1w',
    });
    expect(result.rangeStartIndex).toBe(0);
    expect(result.bars).toHaveLength(2);
    expect(result.bars.map((b) => b.close)).toEqual([1, 2]);
  });

  it('prepends prior weeks when from is set for weekly lookback', async () => {
    symbolDelegate.findUnique.mockResolvedValue({ id: 's1' });
    dailyPriceDelegate.findMany
      .mockResolvedValueOnce([
        {
          id: 'p0',
          symbolId: 's1',
          date: new Date('2025-12-29T00:00:00.000Z'),
          open: 1,
          high: 1,
          low: 1,
          close: 1,
          volume: 1n,
          createdAt: new Date('2025-12-29T00:00:00.000Z'),
          updatedAt: new Date('2025-12-29T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'p1',
          symbolId: 's1',
          date: new Date('2026-01-05T00:00:00.000Z'),
          open: 2,
          high: 2,
          low: 2,
          close: 2,
          volume: 1n,
          createdAt: new Date('2026-01-05T00:00:00.000Z'),
          updatedAt: new Date('2026-01-05T00:00:00.000Z'),
        },
      ]);

    const result = await service.listWithLookback('s1', {
      from: '2026-01-01',
      to: '2026-01-31',
      lookback: 1,
      interval: '1w',
    });
    expect(result.bars).toHaveLength(2);
    expect(result.rangeStartIndex).toBe(1);
    expect(result.bars[1]?.close).toBe(2);
  });

  it('skips prior daily query when weekly lookback is 0', async () => {
    symbolDelegate.findUnique.mockResolvedValue({ id: 's1' });
    dailyPriceDelegate.findMany.mockResolvedValue([]);

    const result = await service.listWithLookback('s1', {
      from: '2026-01-01',
      lookback: 0,
      interval: '1w',
    });
    expect(result.rangeStartIndex).toBe(0);
    expect(dailyPriceDelegate.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns rangeStartIndex at end when no weekly bar meets from', async () => {
    symbolDelegate.findUnique.mockResolvedValue({ id: 's1' });
    // prior only, and all dates are before from → after aggregation rangeStartIndex = length
    dailyPriceDelegate.findMany
      .mockResolvedValueOnce([
        {
          id: 'p0',
          symbolId: 's1',
          date: new Date('2025-12-01T00:00:00.000Z'),
          open: 1,
          high: 1,
          low: 1,
          close: 1,
          volume: 1n,
          createdAt: new Date('2025-12-01T00:00:00.000Z'),
          updatedAt: new Date('2025-12-01T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.listWithLookback('s1', {
      from: '2026-06-01',
      lookback: 1,
      interval: '1w',
    });
    expect(result.bars).toHaveLength(1);
    expect(result.rangeStartIndex).toBe(1);
  });
});
