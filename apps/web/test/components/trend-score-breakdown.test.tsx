/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import type { TrendScorePoint } from '@market/shared-types';
import {
  buildBreakdownTable,
  formatContributionRatio,
  formatScoreValue,
  indicatorContributionPoints,
  signedContributionShare,
  TrendScoreBreakdown,
} from '../../components/trend-score-breakdown';

function emptyGroups(): TrendScorePoint['groups'] {
  return {
    trend: null,
    momentum: null,
    oscillator: null,
    volatility: null,
    volume: null,
    cycle: null,
  };
}

describe('formatScoreValue', () => {
  it('rounds numbers and shows dash for null', () => {
    expect(formatScoreValue(12.6)).toBe('13');
    expect(formatScoreValue(null)).toBe('—');
  });
});

describe('contribution helpers', () => {
  it('scales indicator score by group weight and valid count', () => {
    // (50/100) * (40/2) = 10
    expect(indicatorContributionPoints(50, 40, 2)).toBe(10);
    expect(indicatorContributionPoints(-25, 20, 1)).toBe(-5);
  });

  it('returns signed share over absolute parts', () => {
    expect(signedContributionShare(10, [10, -10])).toBe(0.5);
    expect(signedContributionShare(-10, [10, -10])).toBe(-0.5);
    expect(signedContributionShare(null, [10])).toBeNull();
    expect(signedContributionShare(1, [null, null])).toBeNull();
    expect(signedContributionShare(0, [0, 0])).toBeNull();
  });

  it('formats contribution ratios', () => {
    expect(formatContributionRatio(null)).toBe('—');
    expect(formatContributionRatio(0)).toBe('0.0%');
    expect(formatContributionRatio(0.123)).toBe('+12.3%');
    expect(formatContributionRatio(-0.04)).toBe('-4.0%');
  });

  it('builds within-group and overall shares for a point', () => {
    const point: TrendScorePoint = {
      date: '2026-01-02',
      score: 28,
      groups: {
        ...emptyGroups(),
        trend: 20,
        momentum: 8,
      },
      indicators: {
        // trend weight 40, 2 valid → contrib 10 and 10
        macd: 50,
        sma25: 50,
        // momentum weight 20, 1 valid → contrib 8
        momentum: 40,
      },
    };
    const table = buildBreakdownTable(point);
    const trend = table.find((row) => row.categoryId === 'trend');
    const momentum = table.find((row) => row.categoryId === 'momentum');
    expect(trend?.groupOverallShare).toBeCloseTo(20 / 28);
    expect(momentum?.groupOverallShare).toBeCloseTo(8 / 28);

    const macd = trend?.indicators.find((row) => row.id === 'macd');
    const sma25 = trend?.indicators.find((row) => row.id === 'sma25');
    expect(macd?.withinGroupShare).toBeCloseTo(0.5);
    expect(sma25?.withinGroupShare).toBeCloseTo(0.5);
    // overall abs denom = 10+10+8 = 28
    expect(macd?.overallShare).toBeCloseTo(10 / 28);
    expect(
      momentum?.indicators.find((row) => row.id === 'momentum')?.overallShare,
    ).toBeCloseTo(8 / 28);
  });
});

describe('TrendScoreBreakdown', () => {
  it('shows empty message when point is missing', () => {
    render(<TrendScoreBreakdown point={null} />);
    expect(screen.getByTestId('trend-score-breakdown-empty')).toHaveTextContent(
      '表示できるスコアがありません',
    );
  });

  it('renders a table with group and indicator contribution ratios', () => {
    const point: TrendScorePoint = {
      date: '2026-01-02',
      score: 42.4,
      groups: {
        ...emptyGroups(),
        trend: 20,
        momentum: 8,
        oscillator: 5,
      },
      indicators: {
        macd: 70,
        rsi: -40,
        momentum: 50,
      },
    };
    render(<TrendScoreBreakdown point={point} />);
    expect(screen.getByTestId('trend-score-breakdown-summary')).toHaveTextContent(
      '基準日 2026-01-02',
    );
    expect(screen.getByTestId('trend-score-breakdown-summary')).toHaveTextContent('総合 42');
    expect(screen.getByTestId('trend-score-breakdown-summary')).toHaveTextContent('上昇トレンド');

    const table = screen.getByTestId('trend-score-breakdown-table');
    expect(within(table).getByText('グループ内貢献度')).toBeInTheDocument();
    expect(within(table).getByText('全体貢献度')).toBeInTheDocument();

    const trendGroup = screen.getByTestId('trend-score-group-trend');
    expect(trendGroup).toHaveTextContent('トレンド系');
    expect(trendGroup).toHaveTextContent('配点 ±40');
    expect(screen.getByTestId('trend-score-group-overall-trend')).toHaveTextContent('+60.6%');

    const macd = screen.getByTestId('trend-score-indicator-macd');
    expect(macd).toHaveTextContent('MACD');
    expect(macd).toHaveTextContent('70');
    expect(screen.getByTestId('trend-score-within-macd')).toHaveTextContent('+100.0%');
    expect(screen.getByTestId('trend-score-overall-macd')).toHaveTextContent('+66.7%');

    expect(screen.getByTestId('trend-score-indicator-rsi')).toHaveTextContent('RSI');
    expect(screen.getByTestId('trend-score-indicator-rsi')).toHaveTextContent('-40');
    expect(screen.getByTestId('trend-score-group-momentum')).toHaveTextContent('モメンタム系');
  });

  it('omits state label when total score is null', () => {
    const point: TrendScorePoint = {
      date: '2026-01-03',
      score: null,
      groups: emptyGroups(),
      indicators: {},
    };
    render(<TrendScoreBreakdown point={point} />);
    expect(screen.getByTestId('trend-score-breakdown-summary')).toHaveTextContent('総合 —');
    expect(screen.getByTestId('trend-score-breakdown-summary')).not.toHaveTextContent('（');
    expect(screen.getByTestId('trend-score-group-overall-trend')).toHaveTextContent('—');
  });
});
