import { ConflictException, NotFoundException } from '@nestjs/common';
import { API_ERROR_CODES } from '@market/shared-types';
import { PrismaService } from '../../src/prisma.service';
import { PortfoliosService } from '../../src/portfolios/portfolios.service';

describe('PortfoliosService', () => {
  const portfolioDelegate = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const holdingDelegate = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const symbolDelegate = {
    findUnique: jest.fn(),
  };
  const dailyPriceDelegate = {
    findFirst: jest.fn(),
  };
  const prismaService = {
    prisma: {
      portfolio: portfolioDelegate,
      portfolioHolding: holdingDelegate,
      symbol: symbolDelegate,
      dailyPrice: dailyPriceDelegate,
    },
  } as unknown as PrismaService;

  let service: PortfoliosService;

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

  const emptyRow = {
    id: 'pf_1',
    userId: 'user_1',
    name: 'Core',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    holdings: [],
  };

  const holdingRow = {
    id: 'h_1',
    portfolioId: 'pf_1',
    symbolId: 'sym_1',
    quantity: 10,
    averageCost: 100,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    symbol,
  };

  const rowWithHolding = {
    ...emptyRow,
    holdings: [holdingRow],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PortfoliosService(prismaService);
  });

  it('lists portfolios and loads latest closes', async () => {
    portfolioDelegate.findMany.mockResolvedValue([rowWithHolding]);
    dailyPriceDelegate.findFirst.mockResolvedValue({
      close: { toString: () => '110' },
    });
    const result = await service.list('user_1');
    expect(result[0]?.totalsByCurrency[0]?.totalMarketValue).toBe(1100);
  });

  it('lists empty portfolio without price queries', async () => {
    portfolioDelegate.findMany.mockResolvedValue([emptyRow]);
    const result = await service.list('user_1');
    expect(result[0]?.holdings).toEqual([]);
    expect(dailyPriceDelegate.findFirst).not.toHaveBeenCalled();
  });

  it('gets by id and skips missing prices', async () => {
    portfolioDelegate.findFirst.mockResolvedValue(rowWithHolding);
    dailyPriceDelegate.findFirst.mockResolvedValue(null);
    const result = await service.getById('user_1', 'pf_1');
    expect(result.holdings[0]?.marketPrice).toBeNull();
  });

  it('throws when portfolio is missing', async () => {
    portfolioDelegate.findFirst.mockResolvedValue(null);
    await expect(service.getById('user_1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a portfolio', async () => {
    portfolioDelegate.create.mockResolvedValue(emptyRow);
    await expect(service.create('user_1', { name: ' Core ' })).resolves.toEqual(
      expect.objectContaining({ name: 'Core' }),
    );
  });

  it('updates a portfolio name', async () => {
    portfolioDelegate.findFirst.mockResolvedValue(emptyRow);
    portfolioDelegate.update.mockResolvedValue({ ...emptyRow, name: 'Satellite' });
    await expect(service.update('user_1', 'pf_1', { name: ' Satellite ' })).resolves.toEqual(
      expect.objectContaining({ name: 'Satellite' }),
    );
  });

  it('updates without name change', async () => {
    portfolioDelegate.findFirst.mockResolvedValue(emptyRow);
    portfolioDelegate.update.mockResolvedValue(emptyRow);
    await service.update('user_1', 'pf_1', {});
    expect(portfolioDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: undefined } }),
    );
  });

  it('removes a portfolio', async () => {
    portfolioDelegate.findFirst.mockResolvedValue(emptyRow);
    portfolioDelegate.delete.mockResolvedValue(emptyRow);
    await service.remove('user_1', 'pf_1');
    expect(portfolioDelegate.delete).toHaveBeenCalledWith({ where: { id: 'pf_1' } });
  });

  it('adds a holding', async () => {
    portfolioDelegate.findFirst
      .mockResolvedValueOnce(emptyRow)
      .mockResolvedValueOnce(rowWithHolding);
    symbolDelegate.findUnique.mockResolvedValue(symbol);
    holdingDelegate.findUnique.mockResolvedValue(null);
    holdingDelegate.create.mockResolvedValue({});
    dailyPriceDelegate.findFirst.mockResolvedValue({ close: { toString: () => '110' } });

    const result = await service.addHolding('user_1', 'pf_1', {
      symbolId: 'sym_1',
      quantity: 10,
      averageCost: 100,
    });
    expect(result.holdings).toHaveLength(1);
  });

  it('rejects add when symbol missing', async () => {
    portfolioDelegate.findFirst.mockResolvedValue(emptyRow);
    symbolDelegate.findUnique.mockResolvedValue(null);
    try {
      await service.addHolding('user_1', 'pf_1', {
        symbolId: 'missing',
        quantity: 1,
        averageCost: 1,
      });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual(
        expect.objectContaining({ code: API_ERROR_CODES.SYMBOL_NOT_FOUND }),
      );
    }
  });

  it('rejects duplicate holding', async () => {
    portfolioDelegate.findFirst.mockResolvedValue(emptyRow);
    symbolDelegate.findUnique.mockResolvedValue(symbol);
    holdingDelegate.findUnique.mockResolvedValue({ id: 'h_1' });
    try {
      await service.addHolding('user_1', 'pf_1', {
        symbolId: 'sym_1',
        quantity: 1,
        averageCost: 1,
      });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ code: API_ERROR_CODES.HOLDING_ALREADY_EXISTS }),
      );
    }
  });

  it('updates a holding', async () => {
    portfolioDelegate.findFirst
      .mockResolvedValueOnce(rowWithHolding)
      .mockResolvedValueOnce(rowWithHolding);
    holdingDelegate.findFirst.mockResolvedValue({ id: 'h_1', portfolioId: 'pf_1' });
    holdingDelegate.update.mockResolvedValue({});
    dailyPriceDelegate.findFirst.mockResolvedValue(null);

    await expect(
      service.updateHolding('user_1', 'pf_1', 'h_1', { quantity: 12 }),
    ).resolves.toEqual(expect.objectContaining({ id: 'pf_1' }));
  });

  it('rejects update when holding missing', async () => {
    portfolioDelegate.findFirst.mockResolvedValue(rowWithHolding);
    holdingDelegate.findFirst.mockResolvedValue(null);
    await expect(
      service.updateHolding('user_1', 'pf_1', 'missing', { quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a holding', async () => {
    portfolioDelegate.findFirst.mockResolvedValueOnce(rowWithHolding).mockResolvedValueOnce(emptyRow);
    holdingDelegate.findFirst.mockResolvedValue({ id: 'h_1', portfolioId: 'pf_1' });
    holdingDelegate.delete.mockResolvedValue({});
    await expect(service.removeHolding('user_1', 'pf_1', 'h_1')).resolves.toEqual(
      expect.objectContaining({ holdings: [] }),
    );
  });

  it('rejects remove when holding missing', async () => {
    portfolioDelegate.findFirst.mockResolvedValue(rowWithHolding);
    holdingDelegate.findFirst.mockResolvedValue(null);
    await expect(service.removeHolding('user_1', 'pf_1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
