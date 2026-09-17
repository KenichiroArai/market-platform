/**
 * deriveBacktestInsights のルール分岐テスト（ADR 019）。
 */
import type { BacktestRunDto, BacktestTradeDto } from '@market/shared-types';
import { DEFAULT_MONEY_MANAGEMENT } from '@market/shared-types';
import { deriveBacktestInsights } from '../../lib/backtest-insights';

function trade(partial: Partial<BacktestTradeDto> & { exitReason?: string | null }): BacktestTradeDto {
  return {
    id: 't1',
    backtestRunId: 'run1',
    symbolId: 'sym1',
    entryDate: '2026-01-01',
    exitDate: '2026-01-10',
    entryPrice: 100,
    exitPrice: 101,
    quantity: 10,
    side: 'buy',
    grossPnl: 10,
    feeAmount: 0,
    slippageAmount: 0,
    netPnl: 10,
    entryReason: 'score_cross_up',
    exitReason: null,
    entryScore: null,
    exitScore: null,
    entryScoreBreakdown: null,
    exitScoreBreakdown: null,
    ...partial,
  };
}

function baseRun(overrides: Partial<BacktestRunDto> = {}): BacktestRunDto {
  return {
    id: 'run1',
    userId: 'u1',
    indicatorSetId: null,
    signalDefinitionId: null,
    strategyType: 'trendScoreThreshold',
    params: { buyThreshold: 37.5, sellThreshold: -42.5 },
    symbolId: 'sym1',
    fromDate: '2026-01-01',
    toDate: '2026-06-30',
    initialCash: 100000,
    feeRate: 0.001,
    slippageRate: 0.001,
    moneyManagement: null,
    exitPolicy: null,
    summary: {
      finalEquity: 110000,
      totalReturnRate: 0.1,
      maxDrawdownRate: 0.05,
      totalTrades: 5,
      winRate: 0.5,
      sharpeRatio: 1,
      profitFactor: 1.5,
      buyHoldReturnRate: 0.08,
      buyHoldFinalEquity: 108000,
    },
    trades: [
      trade({ id: 'a', exitReason: 'score_cross_down' }),
      trade({ id: 'b', exitReason: 'score_cross_down' }),
      trade({ id: 'c', exitReason: 'score_cross_down' }),
      trade({ id: 'd', exitReason: 'score_cross_down' }),
      trade({ id: 'e', exitReason: 'score_cross_down' }),
    ],
    equityPoints: [],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('deriveBacktestInsights', () => {
  it('returns ok_baseline when no rule fires', () => {
    const { insights } = deriveBacktestInsights(baseRun());
    expect(insights).toHaveLength(1);
    expect(insights[0].ruleId).toBe('ok_baseline');
    expect(insights[0].actions.some((a) => a.kind === 'open_strategy')).toBe(true);
  });

  it('flags few_trades', () => {
    const { insights } = deriveBacktestInsights(
      baseRun({
        summary: {
          ...baseRun().summary,
          totalTrades: 1,
        },
        trades: [trade({ exitReason: 'force_close_end' })],
      }),
    );
    expect(insights.some((i) => i.ruleId === 'few_trades')).toBe(true);
  });

  it('flags force_close_heavy and suggests rr_target', () => {
    const trades = [
      trade({ id: '1', exitReason: 'force_close_end' }),
      trade({ id: '2', exitReason: 'force_close_end' }),
      trade({ id: '3', exitReason: 'score_cross_down' }),
      trade({ id: '4', exitReason: 'score_cross_down' }),
      trade({ id: '5', exitReason: 'force_close_end' }),
    ];
    const { insights } = deriveBacktestInsights(
      baseRun({
        summary: { ...baseRun().summary, totalTrades: 5 },
        trades,
      }),
    );
    const hit = insights.find((i) => i.ruleId === 'force_close_heavy');
    expect(hit).toBeDefined();
    expect(hit!.actions.some((a) => a.kind === 'apply_run_preset')).toBe(true);
  });

  it('flags stop_heavy_low_wr', () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      trade({
        id: String(i),
        exitReason: i < 6 ? 'atr_stop_loss' : 'score_cross_down',
        netPnl: i < 6 ? -10 : 10,
      }),
    );
    const { insights } = deriveBacktestInsights(
      baseRun({
        summary: {
          ...baseRun().summary,
          totalTrades: 10,
          winRate: 0.3,
        },
        trades,
        exitPolicy: { stopMethod: 'atr', takeProfitMethod: null },
      }),
    );
    expect(insights.some((i) => i.ruleId === 'stop_heavy_low_wr')).toBe(true);
  });

  it('flags under_buyhold for trendScore with threshold preset', () => {
    const { insights } = deriveBacktestInsights(
      baseRun({
        summary: {
          ...baseRun().summary,
          totalReturnRate: 0.01,
          buyHoldReturnRate: 0.2,
        },
      }),
    );
    const hit = insights.find((i) => i.ruleId === 'under_buyhold');
    expect(hit).toBeDefined();
    expect(hit!.actions.some((a) => a.preset?.buyThreshold === 25)).toBe(true);
  });

  it('flags high_drawdown with reduced risk preset', () => {
    const { insights } = deriveBacktestInsights(
      baseRun({
        summary: { ...baseRun().summary, maxDrawdownRate: 0.35 },
        moneyManagement: {
          ...DEFAULT_MONEY_MANAGEMENT,
          enabled: true,
          riskRate: 0.02,
        },
      }),
    );
    const hit = insights.find((i) => i.ruleId === 'high_drawdown');
    expect(hit).toBeDefined();
    expect(hit!.actions[0].preset?.moneyManagementRiskRate).toBe(0.01);
  });

  it('flags high_wr_low_pf', () => {
    const trades = Array.from({ length: 8 }, (_, i) =>
      trade({ id: String(i), exitReason: 'score_cross_down' }),
    );
    const { insights } = deriveBacktestInsights(
      baseRun({
        summary: {
          ...baseRun().summary,
          totalTrades: 8,
          winRate: 0.7,
          profitFactor: 0.9,
        },
        trades,
      }),
    );
    expect(insights.some((i) => i.ruleId === 'high_wr_low_pf')).toBe(true);
  });

  it('sorts critical before warn and info', () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      trade({
        id: String(i),
        exitReason: i < 6 ? 'atr_stop_loss' : 'force_close_end',
      }),
    );
    const { insights } = deriveBacktestInsights(
      baseRun({
        summary: {
          ...baseRun().summary,
          totalTrades: 10,
          winRate: 0.2,
          maxDrawdownRate: 0.3,
          totalReturnRate: 0,
          buyHoldReturnRate: 0.2,
        },
        trades,
      }),
    );
    const severities = insights.map((i) => i.severity);
    const firstCritical = severities.indexOf('critical');
    const firstWarn = severities.indexOf('warn');
    expect(firstCritical).toBeGreaterThanOrEqual(0);
    if (firstWarn >= 0) {
      expect(firstCritical).toBeLessThan(firstWarn);
    }
  });

  it('flags under_buyhold without threshold preset for non-trend strategies', () => {
    const { insights } = deriveBacktestInsights(
      baseRun({
        strategyType: 'smaCross',
        params: { shortPeriod: 25, longPeriod: 75 },
        summary: {
          ...baseRun().summary,
          totalReturnRate: 0.01,
          buyHoldReturnRate: 0.2,
        },
      }),
    );
    const hit = insights.find((i) => i.ruleId === 'under_buyhold');
    expect(hit).toBeDefined();
    expect(hit!.actions.every((a) => a.preset?.buyThreshold == null)).toBe(true);
  });

  it('counts null exitReason as unknown without treating as stop', () => {
    const { insights } = deriveBacktestInsights(
      baseRun({
        summary: { ...baseRun().summary, totalTrades: 5, winRate: 0.2 },
        trades: Array.from({ length: 5 }, (_, i) => trade({ id: String(i), exitReason: null })),
      }),
    );
    expect(insights.every((i) => i.ruleId !== 'stop_heavy_low_wr')).toBe(true);
  });

  it('uses zero ratios when there are no trades', () => {
    const { insights } = deriveBacktestInsights(
      baseRun({
        summary: { ...baseRun().summary, totalTrades: 0, winRate: 0 },
        trades: [],
      }),
    );
    expect(insights.some((i) => i.ruleId === 'few_trades')).toBe(true);
    expect(insights.every((i) => i.ruleId !== 'force_close_heavy')).toBe(true);
    expect(insights.every((i) => i.ruleId !== 'stop_heavy_low_wr')).toBe(true);
  });
});
