import { Test } from '@nestjs/testing';
import { WatchlistsController } from '../../src/watchlists/watchlists.controller';
import { WatchlistsService } from '../../src/watchlists/watchlists.service';

describe('WatchlistsController', () => {
  let controller: WatchlistsController;
  const watchlistsService = {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    addItem: jest.fn(),
    removeItem: jest.fn(),
  };
  const user = { id: 'user_1', email: 'a@example.com' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [WatchlistsController],
      providers: [{ provide: WatchlistsService, useValue: watchlistsService }],
    }).compile();
    controller = moduleRef.get(WatchlistsController);
  });

  it('delegates all endpoints', async () => {
    watchlistsService.list.mockResolvedValue([]);
    watchlistsService.getById.mockResolvedValue({ id: 'wl_1' });
    watchlistsService.create.mockResolvedValue({ id: 'wl_1' });
    watchlistsService.update.mockResolvedValue({ id: 'wl_1' });
    watchlistsService.remove.mockResolvedValue(undefined);
    watchlistsService.addItem.mockResolvedValue({ id: 'wl_1' });
    watchlistsService.removeItem.mockResolvedValue({ id: 'wl_1' });

    await expect(controller.list(user)).resolves.toEqual([]);
    await expect(controller.getById(user, 'wl_1')).resolves.toEqual({ id: 'wl_1' });
    await expect(controller.create(user, { name: 'Tech' })).resolves.toEqual({ id: 'wl_1' });
    await expect(controller.update(user, 'wl_1', { name: 'X' })).resolves.toEqual({
      id: 'wl_1',
    });
    await expect(controller.remove(user, 'wl_1')).resolves.toBeUndefined();
    await expect(controller.addItem(user, 'wl_1', { symbolId: 'sym_1' })).resolves.toEqual({
      id: 'wl_1',
    });
    await expect(controller.removeItem(user, 'wl_1', 'item_1')).resolves.toEqual({
      id: 'wl_1',
    });
  });
});
