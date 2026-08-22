import { ConflictException, NotFoundException } from '@nestjs/common';
import { API_ERROR_CODES } from '@market/shared-types';
import { PrismaService } from '../../src/prisma.service';
import { WatchlistsService } from '../../src/watchlists/watchlists.service';

describe('WatchlistsService', () => {
  const watchlistDelegate = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const watchlistItemDelegate = {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  const symbolDelegate = {
    findUnique: jest.fn(),
  };
  const prismaService = {
    prisma: {
      watchlist: watchlistDelegate,
      watchlistItem: watchlistItemDelegate,
      symbol: symbolDelegate,
    },
  } as unknown as PrismaService;

  let service: WatchlistsService;

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

  const row = {
    id: 'wl_1',
    userId: 'user_1',
    name: 'Tech',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    items: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WatchlistsService(prismaService);
  });

  it('lists watchlists for user', async () => {
    watchlistDelegate.findMany.mockResolvedValue([row]);
    const result = await service.list('user_1');
    expect(result[0]?.name).toBe('Tech');
    expect(watchlistDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user_1' } }),
    );
  });

  it('gets by id', async () => {
    watchlistDelegate.findFirst.mockResolvedValue(row);
    await expect(service.getById('user_1', 'wl_1')).resolves.toEqual(
      expect.objectContaining({ id: 'wl_1' }),
    );
  });

  it('throws when watchlist is missing', async () => {
    watchlistDelegate.findFirst.mockResolvedValue(null);
    await expect(service.getById('user_1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a watchlist', async () => {
    watchlistDelegate.create.mockResolvedValue(row);
    await expect(service.create('user_1', { name: ' Tech ' })).resolves.toEqual(
      expect.objectContaining({ name: 'Tech' }),
    );
    expect(watchlistDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 'user_1', name: 'Tech' },
      }),
    );
  });

  it('updates a watchlist name', async () => {
    watchlistDelegate.findFirst.mockResolvedValue(row);
    watchlistDelegate.update.mockResolvedValue({ ...row, name: 'Growth' });
    await expect(service.update('user_1', 'wl_1', { name: ' Growth ' })).resolves.toEqual(
      expect.objectContaining({ name: 'Growth' }),
    );
  });

  it('updates without name change', async () => {
    watchlistDelegate.findFirst.mockResolvedValue(row);
    watchlistDelegate.update.mockResolvedValue(row);
    await service.update('user_1', 'wl_1', {});
    expect(watchlistDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: undefined } }),
    );
  });

  it('removes a watchlist', async () => {
    watchlistDelegate.findFirst.mockResolvedValue(row);
    watchlistDelegate.delete.mockResolvedValue(row);
    await service.remove('user_1', 'wl_1');
    expect(watchlistDelegate.delete).toHaveBeenCalledWith({ where: { id: 'wl_1' } });
  });

  it('adds an item', async () => {
    watchlistDelegate.findFirst
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce({
        ...row,
        items: [
          {
            id: 'item_1',
            watchlistId: 'wl_1',
            symbolId: 'sym_1',
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            symbol,
          },
        ],
      });
    symbolDelegate.findUnique.mockResolvedValue(symbol);
    watchlistItemDelegate.findUnique.mockResolvedValue(null);
    watchlistItemDelegate.create.mockResolvedValue({});

    const result = await service.addItem('user_1', 'wl_1', { symbolId: 'sym_1' });
    expect(result.items).toHaveLength(1);
  });

  it('rejects add when symbol missing', async () => {
    watchlistDelegate.findFirst.mockResolvedValue(row);
    symbolDelegate.findUnique.mockResolvedValue(null);
    try {
      await service.addItem('user_1', 'wl_1', { symbolId: 'missing' });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual(
        expect.objectContaining({ code: API_ERROR_CODES.SYMBOL_NOT_FOUND }),
      );
    }
  });

  it('rejects duplicate item', async () => {
    watchlistDelegate.findFirst.mockResolvedValue(row);
    symbolDelegate.findUnique.mockResolvedValue(symbol);
    watchlistItemDelegate.findUnique.mockResolvedValue({ id: 'item_1' });
    try {
      await service.addItem('user_1', 'wl_1', { symbolId: 'sym_1' });
      fail('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ code: API_ERROR_CODES.WATCHLIST_ITEM_ALREADY_EXISTS }),
      );
    }
  });

  it('removes an item', async () => {
    watchlistDelegate.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    watchlistItemDelegate.findFirst.mockResolvedValue({ id: 'item_1', watchlistId: 'wl_1' });
    watchlistItemDelegate.delete.mockResolvedValue({});
    await expect(service.removeItem('user_1', 'wl_1', 'item_1')).resolves.toEqual(
      expect.objectContaining({ id: 'wl_1' }),
    );
  });

  it('rejects remove when item missing', async () => {
    watchlistDelegate.findFirst.mockResolvedValue(row);
    watchlistItemDelegate.findFirst.mockResolvedValue(null);
    await expect(service.removeItem('user_1', 'wl_1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
