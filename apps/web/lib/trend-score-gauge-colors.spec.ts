import { TREND_SCORE_GAUGE_COLORS } from './trend-score-gauge-colors';

describe('TREND_SCORE_GAUGE_COLORS', () => {
  it('covers every trend score state id', () => {
    expect(TREND_SCORE_GAUGE_COLORS.strongUp).toMatch(/^#/);
    expect(TREND_SCORE_GAUGE_COLORS.upTrend).toMatch(/^#/);
    expect(TREND_SCORE_GAUGE_COLORS.rangeUp).toMatch(/^#/);
    expect(TREND_SCORE_GAUGE_COLORS.range).toMatch(/^#/);
    expect(TREND_SCORE_GAUGE_COLORS.rangeDown).toMatch(/^#/);
    expect(TREND_SCORE_GAUGE_COLORS.downTrend).toMatch(/^#/);
    expect(TREND_SCORE_GAUGE_COLORS.strongDown).toMatch(/^#/);
  });
});
