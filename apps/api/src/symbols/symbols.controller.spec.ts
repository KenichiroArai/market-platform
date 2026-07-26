import { Test } from '@nestjs/testing';
import { PricesService } from '../prices/prices.service';
import { SymbolsController } from './symbols.controller';
import { SymbolsService } from './symbols.service';

describe('SymbolsController', () => {
  let controller: SymbolsController;
  const symbolsService = {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const pricesService = {
    listBySymbolId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [SymbolsController],
      providers: [
        { provide: SymbolsService, useValue: symbolsService },
        { provide: PricesService, useValue: pricesService },
      ],
    }).compile();
    controller = moduleRef.get(SymbolsController);
  });

  it('lists with isActive query parsing', async () => {
    symbolsService.list.mockResolvedValue([]);
    await controller.list('US', 'true');
    expect(symbolsService.list).toHaveBeenCalledWith({ market: 'US', isActive: true });

    await controller.list(undefined, '1');
    expect(symbolsService.list).toHaveBeenCalledWith({
      market: undefined,
      isActive: true,
    });

    await controller.list(undefined, 'false');
    expect(symbolsService.list).toHaveBeenCalledWith({
      market: undefined,
      isActive: false,
    });

    await controller.list();
    expect(symbolsService.list).toHaveBeenCalledWith({
      market: undefined,
      isActive: undefined,
    });
  });

  it('delegates get / create / update / prices', async () => {
    symbolsService.getById.mockResolvedValue({ id: 's1' });
    symbolsService.create.mockResolvedValue({ id: 's1' });
    symbolsService.update.mockResolvedValue({ id: 's1' });
    pricesService.listBySymbolId.mockResolvedValue([]);

    await expect(controller.getById('s1')).resolves.toEqual({ id: 's1' });
    await expect(
      controller.create({
        ticker: 'AAPL',
        market: 'US',
        name: 'Apple',
        currency: 'USD',
      }),
    ).resolves.toEqual({ id: 's1' });
    await expect(controller.update('s1', { isActive: false })).resolves.toEqual({ id: 's1' });
    await expect(controller.listPrices('s1', '2026-01-01', '2026-01-31')).resolves.toEqual([]);
    expect(pricesService.listBySymbolId).toHaveBeenCalledWith('s1', {
      from: '2026-01-01',
      to: '2026-01-31',
    });
  });
});
