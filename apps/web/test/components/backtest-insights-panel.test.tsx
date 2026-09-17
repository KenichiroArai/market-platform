import { fireEvent, render, screen } from '@testing-library/react';
import type { BacktestInsight } from '@market/shared-types';
import { BacktestInsightsPanel } from '../../components/backtest-insights-panel';

const sample: BacktestInsight[] = [
  {
    ruleId: 'few_trades',
    summary: '取引が少ない',
    evidence: ['取引数: 1'],
    severity: 'warn',
    actions: [
      { kind: 'apply_run_preset', label: '再実行', preset: { buyThreshold: 25 } },
      { kind: 'open_strategy', label: '戦略', hrefHint: { symbolId: 's1' } },
    ],
  },
  {
    ruleId: 'ok_baseline',
    summary: '特記なし',
    evidence: [],
    severity: 'info',
    actions: [{ kind: 'open_charts', label: 'チャート' }],
  },
];

describe('BacktestInsightsPanel', () => {
  it('renders insights and invokes onAction', () => {
    const onAction = jest.fn();
    render(
      <BacktestInsightsPanel insights={sample} onAction={onAction} appliedNote="適用済み" />,
    );
    expect(screen.getByTestId('backtest-insights-panel')).toBeInTheDocument();
    expect(screen.getByTestId('insights-applied-note')).toHaveTextContent('適用済み');
    expect(screen.getByTestId('insight-few_trades')).toHaveTextContent('取引が少ない');
    fireEvent.click(screen.getByTestId('insight-action-few_trades-apply_run_preset'));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'apply_run_preset', label: '再実行' }),
    );
  });

  it('omits applied note when null', () => {
    render(<BacktestInsightsPanel insights={sample} onAction={jest.fn()} />);
    expect(screen.queryByTestId('insights-applied-note')).not.toBeInTheDocument();
  });
});
