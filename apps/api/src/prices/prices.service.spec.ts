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

  it('throws when symbol is missing', async () => {
    symbolDelegate.findUnique.mockResolvedValue(null);
    await expect(service.listBySymbolId('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
