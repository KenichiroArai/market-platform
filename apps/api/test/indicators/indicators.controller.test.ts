import { Test } from '@nestjs/testing';
import { IndicatorsController } from '../../src/indicators/indicators.controller';
import { IndicatorsService } from '../../src/indicators/indicators.service';

describe('IndicatorsController', () => {
  let controller: IndicatorsController;
  const indicatorsService = {
    getForSymbol: jest.fn(),
    getTrendScoreForSymbol: jest.fn(),
    getEntryAdviceForSymbol: jest.fn(),
    getTradePlanForSymbol: jest.fn(),
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

  it('delegates entry advice to IndicatorsService', async () => {
    indicatorsService.getEntryAdviceForSymbol.mockResolvedValue({
      symbolId: 's1',
      baseDate: '2026-01-10',
      entryTiming: 'wait',
      direction: 'long',
      signalActive: false,
      signalLabel: 'test',
      noRuleReason: null,
      position: null,
      mm: null,
      pyramidLevels: null,
      predictedEntry: null,
      scoreAtBase: null,
      buyThreshold: 37.5,
      sellThreshold: -42.5,
      scoreBreakdown: null,
      rationale: null,
      entryReasonCode: null,
      newEntryFromBase: null,
    });
    const query = { baseDate: '2026-01-10', initialCash: '100000' };
    await expect(controller.getEntryAdvice('s1', query)).resolves.toMatchObject({
      symbolId: 's1',
      entryTiming: 'wait',
    });
    expect(indicatorsService.getEntryAdviceForSymbol).toHaveBeenCalledWith('s1', query);
  });

  it('delegates trade plan to IndicatorsService', async () => {
    indicatorsService.getTradePlanForSymbol.mockResolvedValue({
      symbolId: 's1',
      baseDate: '2026-01-10',
      judgment: {
        level: 'buy',
        score: 70,
        stars: 4,
        label: 'やや買い',
        factors: [],
      },
      entry: {
        currentPrice: 100,
        recommendedPrice: 98,
        side: 'long',
        rationale: '押し目',
      },
      stopLossCandidates: [],
      takeProfitCandidates: [],
      recommendedStop: null,
      recommendedTarget: null,
      riskReward: null,
      position: null,
      riskRating: { level: 'low', stars: 1, atrPercent: 1, notes: [] },
      buyReasons: [],
      sellReasons: [],
      overallScore: 70,
      summaryLabel: 'やや買い / 総合 70 点',
    });
    const query = { equity: '1000000', riskRate: '0.01' };
    await expect(controller.getTradePlan('s1', query)).resolves.toMatchObject({
      symbolId: 's1',
      overallScore: 70,
    });
    expect(indicatorsService.getTradePlanForSymbol).toHaveBeenCalledWith('s1', query);
  });
});
