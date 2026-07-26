import { ConflictException, NotFoundException } from '@nestjs/common';
import { API_ERROR_CODES } from '@market/shared-types';
import { PrismaService } from '../prisma.service';
import { SymbolsService } from './symbols.service';

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
    service = new SymbolsService(prismaService);
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

  it('creates a symbol', async () => {
    symbolDelegate.findUnique.mockResolvedValue(null);
    symbolDelegate.create.mockResolvedValue(row);
    await expect(
      service.create({
        ticker: 'aapl',
        market: 'US',
        name: 'Apple',
        currency: 'USD',
        exchange: 'NASDAQ',
      }),
    ).resolves.toEqual(expect.objectContaining({ ticker: 'AAPL' }));
    expect(symbolDelegate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ticker: 'AAPL', isActive: true }),
    });
  });

  it('creates with explicit isActive false and null exchange', async () => {
    symbolDelegate.findUnique.mockResolvedValue(null);
    symbolDelegate.create.mockResolvedValue({ ...row, isActive: false, exchange: null });
    await service.create({
      ticker: 'MSFT',
      market: 'US',
      name: 'Microsoft',
      currency: 'USD',
      isActive: false,
    });
    expect(symbolDelegate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ exchange: null, isActive: false }),
    });
  });

  it('rejects duplicate ticker+market', async () => {
    symbolDelegate.findUnique.mockResolvedValue(row);
    try {
      await service.create({
        ticker: 'AAPL',
        market: 'US',
        name: 'Apple',
        currency: 'USD',
      });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ code: API_ERROR_CODES.SYMBOL_ALREADY_EXISTS }),
      );
    }
  });

  it('updates a symbol', async () => {
    symbolDelegate.findUnique.mockResolvedValue(row);
    symbolDelegate.update.mockResolvedValue({ ...row, name: 'Apple Inc.' });
    await expect(
      service.update('s1', { name: 'Apple Inc.', isActive: false }),
    ).resolves.toEqual(expect.objectContaining({ name: 'Apple Inc.' }));
  });
});
