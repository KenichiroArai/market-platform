import { Test } from '@nestjs/testing';
import { PortfoliosController } from './portfolios.controller';
import { PortfoliosService } from './portfolios.service';

describe('PortfoliosController', () => {
  let controller: PortfoliosController;
  const portfoliosService = {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    addHolding: jest.fn(),
    updateHolding: jest.fn(),
    removeHolding: jest.fn(),
  };
  const user = { id: 'user_1', email: 'a@example.com' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [PortfoliosController],
      providers: [{ provide: PortfoliosService, useValue: portfoliosService }],
    }).compile();
    controller = moduleRef.get(PortfoliosController);
  });

  it('delegates all endpoints', async () => {
    portfoliosService.list.mockResolvedValue([]);
    portfoliosService.getById.mockResolvedValue({ id: 'pf_1' });
    portfoliosService.create.mockResolvedValue({ id: 'pf_1' });
    portfoliosService.update.mockResolvedValue({ id: 'pf_1' });
    portfoliosService.remove.mockResolvedValue(undefined);
    portfoliosService.addHolding.mockResolvedValue({ id: 'pf_1' });
    portfoliosService.updateHolding.mockResolvedValue({ id: 'pf_1' });
    portfoliosService.removeHolding.mockResolvedValue({ id: 'pf_1' });

    await expect(controller.list(user)).resolves.toEqual([]);
    await expect(controller.getById(user, 'pf_1')).resolves.toEqual({ id: 'pf_1' });
    await expect(controller.create(user, { name: 'Core' })).resolves.toEqual({ id: 'pf_1' });
    await expect(controller.update(user, 'pf_1', { name: 'X' })).resolves.toEqual({
      id: 'pf_1',
    });
    await expect(controller.remove(user, 'pf_1')).resolves.toBeUndefined();
    await expect(
      controller.addHolding(user, 'pf_1', {
        symbolId: 'sym_1',
        quantity: 1,
        averageCost: 1,
      }),
    ).resolves.toEqual({ id: 'pf_1' });
    await expect(
      controller.updateHolding(user, 'pf_1', 'h_1', { quantity: 2 }),
    ).resolves.toEqual({ id: 'pf_1' });
    await expect(controller.removeHolding(user, 'pf_1', 'h_1')).resolves.toEqual({
      id: 'pf_1',
    });
  });
});
