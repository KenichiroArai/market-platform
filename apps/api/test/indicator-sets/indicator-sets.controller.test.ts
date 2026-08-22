import { Test } from '@nestjs/testing';
import { IndicatorSetsController } from '../../src/indicator-sets/indicator-sets.controller';
import { IndicatorSetsService } from '../../src/indicator-sets/indicator-sets.service';

describe('IndicatorSetsController', () => {
  let controller: IndicatorSetsController;
  const indicatorSetsService = {
    list: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };
  const user = { id: 'user_1', email: 'a@example.com' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [IndicatorSetsController],
      providers: [{ provide: IndicatorSetsService, useValue: indicatorSetsService }],
    }).compile();
    controller = moduleRef.get(IndicatorSetsController);
  });

  it('delegates all endpoints', async () => {
    indicatorSetsService.list.mockResolvedValue([]);
    indicatorSetsService.create.mockResolvedValue({ id: 'set_1' });
    indicatorSetsService.remove.mockResolvedValue(undefined);

    await expect(controller.list(user)).resolves.toEqual([]);
    await expect(
      controller.create(user, { name: 'スイング', indicatorIds: ['sma25'] }),
    ).resolves.toEqual({ id: 'set_1' });
    await expect(controller.remove(user, 'set_1')).resolves.toBeUndefined();
  });
});
