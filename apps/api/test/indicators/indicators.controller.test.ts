import { Test } from '@nestjs/testing';
import { IndicatorsController } from '../../src/indicators/indicators.controller';
import { IndicatorsService } from '../../src/indicators/indicators.service';

describe('IndicatorsController', () => {
  let controller: IndicatorsController;
  const indicatorsService = {
    getForSymbol: jest.fn(),
    getTrendScoreForSymbol: jest.fn(),
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

  it('delegates trend score to IndicatorsService', async () => {
    indicatorsService.getTrendScoreForSymbol.mockResolvedValue({
      symbolId: 's1',
      points: [],
    });
    const query = { from: '2026-01-01', interval: '1d' as const };
    await expect(controller.getTrendScore('s1', query)).resolves.toEqual({
      symbolId: 's1',
      points: [],
    });
    expect(indicatorsService.getTrendScoreForSymbol).toHaveBeenCalledWith('s1', query);
  });
});
