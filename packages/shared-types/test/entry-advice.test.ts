import {
  createEntryAdviceDto,
  entryAdvicePriceLines,
  isEntryAdviceDto,
  isEntryDirection,
  isEntryTiming,
  resolveChartSignalRule,
  resolvedRuleToAnalysisSignal,
  DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS,
} from '../src';

const sampleAdvice = {
  symbolId: 'sym_1',
  baseDate: '2026-01-10',
  entryTiming: 'wait' as const,
  direction: 'long' as const,
  signalActive: false,
  signalLabel: 'トレンドスコア閾値',
  noRuleReason: null,
  position: null,
  mm: {
    atr: 2.5,
    riskRate: 0.01,
    unitQuantity: 100,
    stopPrice: 95,
  },
  pyramidLevels: [
    { unitIndex: 2, price: 102, reached: false },
    { unitIndex: 3, price: 104, reached: true },
  ],
  predictedEntry: {
    triggerDate: '2026-01-15',
    triggerPrice: 101,
    direction: 'long' as const,
    basis: 'スコア外挿',
    note: '参考値です',
  },
  scoreAtBase: 12,
  buyThreshold: 37.5,
  sellThreshold: -42.5,
  scoreBreakdown: { groups: { trend: 8 }, indicators: { sma25: 5 } },
  rationale: '総合スコア 12',
  entryReasonCode: null,
  newEntryFromBase: null,
};

describe('entry-advice types', () => {
  it('validates entry timing and direction', () => {
    expect(isEntryTiming('wait')).toBe(true);
    expect(isEntryTiming('bad')).toBe(false);
    expect(isEntryDirection('long')).toBe(true);
    expect(isEntryDirection('flat')).toBe(false);
  });

  it('validates EntryAdviceDto', () => {
    expect(isEntryAdviceDto(sampleAdvice)).toBe(true);
    expect(isEntryAdviceDto(null)).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, entryTiming: 'x' })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, direction: 'flat' })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, noRuleReason: 1 })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, position: 'bad' })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, position: { entryDate: 'x' } })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, position: { entryDate: 'x', entryPrice: 1, units: '1', isLong: true } })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, position: { entryDate: 'x', entryPrice: 1, units: 1, isLong: 'yes' } })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, mm: 'bad' })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, mm: { atr: 'x' } })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, pyramidLevels: [null] })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, pyramidLevels: [{ unitIndex: 1 }] })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, predictedEntry: 1 })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, predictedEntry: { direction: 'up' } })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, scoreAtBase: 'x' })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, buyThreshold: 'x' })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, sellThreshold: 'x' })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, scoreBreakdown: null })).toBe(true);
    expect(isEntryAdviceDto({ ...sampleAdvice, scoreBreakdown: { groups: null } })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, scoreBreakdown: 'bad' })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, rationale: 1 })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, entryReasonCode: 1 })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, newEntryFromBase: 'bad' })).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, newEntryFromBase: { entryPrice: 1 } })).toBe(false);
    expect(
      isEntryAdviceDto({
        ...sampleAdvice,
        newEntryFromBase: {
          entryPrice: 1,
          isLong: true,
          mm: 'bad',
          pyramidLevels: null,
        },
      }),
    ).toBe(false);
    expect(
      isEntryAdviceDto({
        ...sampleAdvice,
        newEntryFromBase: {
          entryPrice: 1,
          isLong: true,
          mm: null,
          pyramidLevels: [{ unitIndex: 1 }],
        },
      }),
    ).toBe(false);
    expect(isEntryAdviceDto({ ...sampleAdvice, newEntryFromBase: null })).toBe(true);
    expect(createEntryAdviceDto(sampleAdvice)).toEqual(sampleAdvice);
  });

  it('builds chart price lines from new entry from base', () => {
    const lines = entryAdvicePriceLines({
      ...sampleAdvice,
      mm: null,
      pyramidLevels: null,
      predictedEntry: null,
      newEntryFromBase: {
        entryPrice: 100,
        isLong: true,
        mm: { atr: 2, riskRate: 0.01, unitQuantity: 10, stopPrice: 96 },
        pyramidLevels: [{ unitIndex: 2, price: 103, reached: false }],
      },
    });
    expect(lines).toEqual([
      { price: 96, color: '#ef5350', title: '新規ストップ' },
      { price: 103, color: '#42a5f5', title: '新規追加 U2' },
    ]);
  });

  it('builds chart price lines when optional fields are absent', () => {
    expect(entryAdvicePriceLines({ ...sampleAdvice, mm: null, pyramidLevels: null, predictedEntry: null })).toEqual([]);
    expect(
      entryAdvicePriceLines({
        ...sampleAdvice,
        mm: { atr: null, riskRate: null, unitQuantity: null, stopPrice: null },
        pyramidLevels: [{ unitIndex: 2, price: 102, reached: true }],
        predictedEntry: { triggerDate: null, triggerPrice: null, direction: 'long', basis: 'x', note: 'y' },
      }),
    ).toEqual([]);
  });

  it('builds chart price lines from advice', () => {
    const lines = entryAdvicePriceLines(sampleAdvice);
    expect(lines).toEqual([
      { price: 95, color: '#ef5350', title: 'ストップ' },
      { price: 102, color: '#42a5f5', title: '追加 U2' },
      { price: 101, color: '#ffca28', title: '予測エントリー' },
    ]);
  });

  it('resolveChartSignalRule falls back to trend score thresholds', () => {
    const rule = resolveChartSignalRule(['bb', 'volume'], {}, { buyThreshold: 40, sellThreshold: -40 });
    expect(rule.strategyType).toBe('trendScoreThreshold');
    expect(rule.params).toEqual({ buyThreshold: 40, sellThreshold: -40 });

    const defaultFallback = resolveChartSignalRule(['bb', 'volume']);
    expect(defaultFallback.strategyType).toBe('trendScoreThreshold');

    const smaRule = resolveChartSignalRule(['sma25', 'sma75']);
    expect(smaRule.strategyType).toBe('smaCross');
    expect(resolvedRuleToAnalysisSignal(smaRule)).toEqual({
      strategyType: 'smaCross',
      shortPeriod: 25,
      longPeriod: 75,
    });
  });

  it('resolvedRuleToAnalysisSignal maps all strategy types', () => {
    const trend = resolveChartSignalRule(['bb'], {}, DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS);
    expect(resolvedRuleToAnalysisSignal(trend)).toMatchObject({
      strategyType: 'trendScoreThreshold',
    });

    const rsi = resolveChartSignalRule(['rsi']);
    expect(resolvedRuleToAnalysisSignal(rsi)).toMatchObject({
      strategyType: 'rsiThreshold',
      period: 14,
    });

    const macd = resolveChartSignalRule(['macd']);
    expect(resolvedRuleToAnalysisSignal(macd)).toMatchObject({
      strategyType: 'macdCross',
      fast: 12,
      slow: 26,
      signal: 9,
    });
  });
});
