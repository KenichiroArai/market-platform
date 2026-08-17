import { rgbaString, trendScoreToRgba, TREND_SCORE_COLOR_STOPS } from './trend-score-color';

describe('trendScoreToRgba', () => {
  it('uses endpoint colors outside the stop range', () => {
    expect(trendScoreToRgba(100)).toBe(rgbaString(TREND_SCORE_COLOR_STOPS[0]!.rgba));
    expect(trendScoreToRgba(95)).toBe(rgbaString(TREND_SCORE_COLOR_STOPS[0]!.rgba));
    expect(trendScoreToRgba(-100)).toBe(rgbaString(TREND_SCORE_COLOR_STOPS[6]!.rgba));
    expect(trendScoreToRgba(-95)).toBe(rgbaString(TREND_SCORE_COLOR_STOPS[6]!.rgba));
  });

  it('interpolates between stops and is transparent at 0', () => {
    expect(trendScoreToRgba(0)).toBe('rgba(18, 38, 58, 0)');
    const mid = trendScoreToRgba(37.5);
    expect(mid.startsWith('rgba(')).toBe(true);
    expect(trendScoreToRgba(-10).startsWith('rgba(')).toBe(true);
    expect(trendScoreToRgba(Number.NaN)).toBe(rgbaString(TREND_SCORE_COLOR_STOPS[6]!.rgba));
  });
});
