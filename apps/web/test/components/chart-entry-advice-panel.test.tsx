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
    render(
      <ChartEntryAdvicePanel
        advice={{
          ...advice,
          pyramidLevels: [
            { unitIndex: 2, price: 103, reached: false },
            { unitIndex: 3, price: 106, reached: true },
          ],
        }}
      />,
    );
    expect(screen.getByTestId('entry-advice-panel')).toBeInTheDocument();
    expect(screen.getByTestId('entry-advice-timing')).toHaveTextContent('エントリーシグナル');
    expect(screen.getByTestId('entry-advice-signal-label')).toHaveTextContent('SMA クロス');
    expect(screen.getByTestId('entry-advice-mm')).toBeInTheDocument();
    expect(screen.getByTestId('entry-advice-pyramid')).toHaveTextContent('U2');
    expect(screen.getByTestId('entry-advice-pyramid')).toHaveTextContent('到達済');
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

  it('renders newEntryFromBase with null MM metrics and reached pyramid levels', () => {
    render(
      <ChartEntryAdvicePanel
        advice={{
          ...advice,
          position: { ...advice.position!, isLong: false },
          mm: {
            atr: null,
            riskRate: Number.NaN,
            unitQuantity: null,
            stopPrice: 90,
          },
          newEntryFromBase: {
            entryPrice: 101,
            isLong: false,
            mm: {
              atr: 1,
              riskRate: 0.02,
              unitQuantity: 10,
              stopPrice: 95,
            },
            pyramidLevels: [
              { unitIndex: 2, price: 104, reached: true },
              { unitIndex: 3, price: 107, reached: false },
            ],
          },
        }}
      />,
    );
    expect(screen.getByTestId('entry-advice-mm')).toHaveTextContent('—');
    expect(screen.getByTestId('entry-advice-new-entry')).toHaveTextContent('ショート');
    expect(screen.getByTestId('entry-advice-new-entry')).toHaveTextContent('到達済');
  });

  it('covers optional advice fields when absent', () => {
    render(
      <ChartEntryAdvicePanel
        advice={{
          ...advice,
          rationale: null,
          entryReasonCode: null,
          scoreAtBase: null,
          buyThreshold: null,
          sellThreshold: null,
          scoreBreakdown: null,
          position: null,
          mm: null,
          pyramidLevels: null,
          predictedEntry: {
            triggerDate: null,
            triggerPrice: null,
            direction: 'long',
            basis: '根拠のみ',
            note: '注記',
          },
          newEntryFromBase: {
            entryPrice: 100,
            isLong: true,
            mm: null,
            pyramidLevels: null,
          },
        }}
      />,
    );
    expect(screen.queryByTestId('entry-advice-rationale')).not.toBeInTheDocument();
    expect(screen.queryByTestId('entry-advice-score')).not.toBeInTheDocument();
    expect(screen.getByTestId('entry-advice-new-entry')).toHaveTextContent('ロング');
    expect(screen.getByTestId('entry-advice-predicted')).toHaveTextContent('根拠のみ');
    expect(screen.getByTestId('entry-advice-predicted')).not.toHaveTextContent('推定日');
  });

  it('shows score without buy/sell thresholds and empty new-entry pyramid', () => {
    const { rerender } = render(
      <ChartEntryAdvicePanel
        advice={{
          ...advice,
          buyThreshold: null,
          sellThreshold: -40,
          pyramidLevels: [],
          newEntryFromBase: {
            entryPrice: 99,
            isLong: true,
            mm: {
              atr: 1,
              riskRate: 0.01,
              unitQuantity: 5,
              stopPrice: 90,
            },
            pyramidLevels: [],
          },
        }}
      />,
    );
    expect(screen.getByTestId('entry-advice-score')).toHaveTextContent('総合スコア');
    expect(screen.getByTestId('entry-advice-score')).toHaveTextContent('売り');
    expect(screen.getByTestId('entry-advice-score')).not.toHaveTextContent('買い');
    expect(screen.getByTestId('entry-advice-new-entry')).toHaveTextContent('ストップ');
    expect(screen.getByTestId('entry-advice-new-entry').querySelector('ul')).not.toBeInTheDocument();

    rerender(
      <ChartEntryAdvicePanel
        advice={{
          ...advice,
          buyThreshold: 30,
          sellThreshold: null,
          newEntryFromBase: null,
        }}
      />,
    );
    expect(screen.getByTestId('entry-advice-score')).toHaveTextContent('買い');
    expect(screen.getByTestId('entry-advice-score')).not.toHaveTextContent('売り');
  });

  it('returns null when advice is absent', () => {
    const { container } = render(<ChartEntryAdvicePanel advice={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
