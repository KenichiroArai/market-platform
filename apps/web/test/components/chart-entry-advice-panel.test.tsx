/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import type { EntryAdviceDto } from '@market/shared-types';
import { ChartEntryAdvicePanel } from '../../components/chart-entry-advice-panel';

const advice: EntryAdviceDto = {
  symbolId: 'sym_1',
  baseDate: '2026-01-10',
  entryTiming: 'entry_now',
  direction: 'long',
  signalActive: true,
  signalLabel: 'SMA クロス',
  noRuleReason: null,
  position: {
    entryDate: '2026-01-10',
    entryPrice: 100,
    units: 1,
    isLong: true,
  },
  mm: {
    atr: 2,
    riskRate: 0.01,
    unitQuantity: 50,
    stopPrice: 96,
  },
  pyramidLevels: [{ unitIndex: 2, price: 103, reached: false }],
  predictedEntry: null,
  scoreAtBase: 40,
  buyThreshold: 37.5,
  sellThreshold: -42.5,
  scoreBreakdown: { groups: { trend: 8 }, indicators: { sma25: 5 } },
  rationale: '買いシグナル',
  entryReasonCode: 'score_cross_up',
  newEntryFromBase: null,
};

describe('ChartEntryAdvicePanel', () => {
  it('shows loading and error states', () => {
    const { rerender } = render(<ChartEntryAdvicePanel advice={null} loading />);
    expect(screen.getByTestId('entry-advice-loading')).toBeInTheDocument();

    rerender(<ChartEntryAdvicePanel advice={null} error="失敗" />);
    expect(screen.getByTestId('entry-advice-error')).toHaveTextContent('失敗');
  });

  it('renders entry_now advice with MM and pyramid', () => {
    render(<ChartEntryAdvicePanel advice={advice} />);
    expect(screen.getByTestId('entry-advice-panel')).toBeInTheDocument();
    expect(screen.getByTestId('entry-advice-timing')).toHaveTextContent('エントリーシグナル');
    expect(screen.getByTestId('entry-advice-signal-label')).toHaveTextContent('SMA クロス');
    expect(screen.getByTestId('entry-advice-mm')).toBeInTheDocument();
    expect(screen.getByTestId('entry-advice-pyramid')).toHaveTextContent('U2');
  });

  it('renders wait state with predicted entry', () => {
    const waitAdvice: EntryAdviceDto = {
      ...advice,
      entryTiming: 'wait',
      signalActive: false,
      position: null,
      mm: null,
      pyramidLevels: null,
      predictedEntry: {
        triggerDate: '2026-01-20',
        triggerPrice: 105,
        direction: 'long',
        basis: '外挿',
        note: '参考',
      },
    };
    render(<ChartEntryAdvicePanel advice={waitAdvice} />);
    expect(screen.getByTestId('entry-advice-predicted')).toHaveTextContent('外挿');
    expect(screen.getByTestId('entry-advice-predicted')).toHaveTextContent('2026-01-20');
  });

  it('renders no_rule reason', () => {
    render(
      <ChartEntryAdvicePanel
        advice={{
          ...advice,
          entryTiming: 'no_rule',
          direction: null,
          signalActive: false,
          position: null,
          mm: null,
          pyramidLevels: null,
          noRuleReason: '指標不足',
        }}
      />,
    );
    expect(screen.getByText('指標不足')).toBeInTheDocument();
  });
});
