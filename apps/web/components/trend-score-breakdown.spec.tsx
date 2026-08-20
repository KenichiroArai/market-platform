/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import type { TrendScorePoint } from '@market/shared-types';
import { formatScoreValue, TrendScoreBreakdown } from './trend-score-breakdown';

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

describe('TrendScoreBreakdown', () => {
  it('shows empty message when point is missing', () => {
    render(<TrendScoreBreakdown point={null} />);
    expect(screen.getByTestId('trend-score-breakdown-empty')).toHaveTextContent(
      '表示できるスコアがありません',
    );
  });

  it('renders groups and indicator scores for the base date', () => {
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
    expect(screen.getByTestId('trend-score-group-trend')).toHaveTextContent('トレンド系');
    expect(screen.getByTestId('trend-score-indicator-macd')).toHaveTextContent('MACD: 70');
    expect(screen.getByTestId('trend-score-indicator-rsi')).toHaveTextContent('RSI: -40');
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
  });
});
