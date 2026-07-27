import { Test } from '@nestjs/testing';
import { IndicatorsController } from './indicators.controller';
import { IndicatorsService } from './indicators.service';

describe('IndicatorsController', () => {
  let controller: IndicatorsController;
  const indicatorsService = {
    getForSymbol: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [IndicatorsController],
      providers: [{ provide: IndicatorsService, useValue: indicatorsService }],
    }).compile();
    controller = moduleRef.get(IndicatorsController);
  });

  it('delegates to IndicatorsService', async () => {
    indicatorsService.getForSymbol.mockResolvedValue({
      symbolId: 's1',
      indicators: [],
      points: [],
    });
    const query = { indicators: 'sma', from: '2026-01-01' };
    await expect(controller.getIndicators('s1', query)).resolves.toEqual({
      symbolId: 's1',
      indicators: [],
      points: [],
    });
    expect(indicatorsService.getForSymbol).toHaveBeenCalledWith('s1', query);
  });
});
