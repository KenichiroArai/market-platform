/**
 * トレードプラン DTO（ADR 018）の契約テスト。
 */
import {
  createTradePlanDto,
  isRiskLevel,
  isStopLossMethod,
  isTakeProfitMethod,
  isTradeJudgmentLevel,
  isTradePlanDto,
  JUDGMENT_LEVEL_LABELS,
  RISK_LEVEL_LABELS,
} from '../src';

const samplePlan = {
  symbolId: 'sym_1',
  baseDate: '2026-06-15',
  judgment: {
    level: 'buy' as const,
    score: 68,
    stars: 4,
    label: 'やや買い',
    factors: [{ id: 'trend_score', label: 'トレンドスコア', contribution: 10, note: 'スコア 20' }],
  },
  entry: {
    currentPrice: 100,
    recommendedPrice: 98,
    side: 'long' as const,
    rationale: '押し目',
  },
  stopLossCandidates: [
    {
      method: 'atr_x2',
      label: 'ATR×2',
      price: 94,
      rationale: 'ATR',
      recommended: true,
    },
  ],
  takeProfitCandidates: [
    {
      method: 'rr_target',
      label: 'RR 2',
      price: 110,
      rationale: 'RR',
      recommended: true,
    },
  ],
  recommendedStop: {
    method: 'atr_x2',
    label: 'ATR×2',
    price: 94,
    rationale: 'ATR',
    recommended: true,
  },
  recommendedTarget: {
    method: 'rr_target',
    label: 'RR 2',
    price: 110,
    rationale: 'RR',
    recommended: true,
  },
  riskReward: { entry: 98, stop: 94, target: 110, riskReward: 3 },
  position: {
    recommendedShares: 100,
    maxShares: 1000,
    requiredCapital: 9800,
    maxLoss: 400,
    equity: 100000,
    riskRate: 0.01,
  },
  riskRating: {
    level: 'medium' as const,
    stars: 3,
    atrPercent: 2.1,
    notes: ['ATR% は中程度'],
  },
  buyReasons: ['MACD 正'],
  sellReasons: [],
  overallScore: 72,
  summaryLabel: 'やや買い / 総合 72 点',
};

describe('trade-plan types', () => {
  it('validates enums', () => {
    expect(isTradeJudgmentLevel('buy')).toBe(true);
    expect(isTradeJudgmentLevel('nope')).toBe(false);
    expect(isStopLossMethod('atr_x2')).toBe(true);
    expect(isStopLossMethod('x')).toBe(false);
    expect(isTakeProfitMethod('none')).toBe(true);
    expect(isTakeProfitMethod('x')).toBe(false);
    expect(isRiskLevel('high')).toBe(true);
    expect(isRiskLevel('x')).toBe(false);
  });

  it('accepts a full trade plan', () => {
    expect(isTradePlanDto(samplePlan)).toBe(true);
    expect(createTradePlanDto(samplePlan).symbolId).toBe('sym_1');
    expect(JUDGMENT_LEVEL_LABELS.buy).toBe('やや買い');
    expect(RISK_LEVEL_LABELS.low).toBe('低');
  });

  it('rejects invalid payloads', () => {
    expect(isTradePlanDto(null)).toBe(false);
    expect(isTradePlanDto({})).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, symbolId: 1 })).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, judgment: { level: 'bad' } })).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, judgment: null })).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        judgment: { level: 'buy', score: 1, stars: 1, label: 'x', factors: 'bad' },
      }),
    ).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, entry: { currentPrice: 1 } })).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, entry: null })).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        stopLossCandidates: [{ method: 1 }],
      }),
    ).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, stopLossCandidates: 'x' })).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, takeProfitCandidates: 'x' })).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        recommendedStop: { method: 'atr' },
      }),
    ).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        recommendedTarget: { method: 'atr' },
      }),
    ).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        riskReward: { entry: 1 },
      }),
    ).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        position: { recommendedShares: 1 },
      }),
    ).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        riskRating: { level: 'weird', stars: 1, atrPercent: null, notes: [] },
      }),
    ).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        riskRating: null,
      }),
    ).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        riskRating: { level: 'low', stars: 1, atrPercent: 'x', notes: [] },
      }),
    ).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        stopLossCandidates: [null],
      }),
    ).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        riskReward: 'bad',
      }),
    ).toBe(false);
    expect(
      isTradePlanDto({
        ...samplePlan,
        position: 'bad',
      }),
    ).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, buyReasons: 'x' })).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, sellReasons: 'x' })).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, overallScore: 'x' })).toBe(false);
    expect(isTradePlanDto({ ...samplePlan, summaryLabel: 1 })).toBe(false);
  });

  it('accepts short side entry', () => {
    expect(
      isTradePlanDto({
        ...samplePlan,
        entry: {
          currentPrice: 100,
          recommendedPrice: 102,
          side: 'short',
          rationale: '戻り',
        },
      }),
    ).toBe(true);
  });

  it('allows null optional fields', () => {
    expect(
      isTradePlanDto({
        ...samplePlan,
        recommendedStop: null,
        recommendedTarget: null,
        riskReward: null,
        position: null,
      }),
    ).toBe(true);
  });
});
