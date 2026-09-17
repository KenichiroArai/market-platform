/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { AnalysisWorkflowBar } from '../../components/analysis-workflow-bar';

describe('AnalysisWorkflowBar', () => {
  const ctx = {
    symbolId: 'sym_1',
    from: '2026-01-01',
    to: '2026-06-30',
    indicatorSetId: 'set_1',
    stopMethod: 'atr',
    takeProfitMethod: 'rr_target',
    equity: 1000000,
    riskRate: 0.01,
  };

  it('marks charts as current and links to analysis and strategy', () => {
    render(<AnalysisWorkflowBar current="charts" context={ctx} />);
    expect(screen.getByTestId('workflow-step-charts')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('workflow-back-to-analysis')).toHaveAttribute(
      'href',
      '/analysis?symbolId=sym_1&from=2026-01-01&to=2026-06-30&indicatorSetId=set_1',
    );
    expect(screen.getByTestId('workflow-next-strategy')).toHaveAttribute(
      'href',
      '/strategy?symbolId=sym_1&from=2026-01-01&to=2026-06-30&stopMethod=atr&takeProfitMethod=rr_target&equity=1000000&riskRate=0.01',
    );
  });

  it('on strategy shows next backtests and charts', () => {
    render(<AnalysisWorkflowBar current="strategy" context={ctx} />);
    expect(screen.getByTestId('workflow-step-strategy')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('workflow-to-charts')).toHaveAttribute(
      'href',
      '/charts?symbolId=sym_1&from=2026-01-01&to=2026-06-30',
    );
    expect(screen.getByTestId('workflow-next-backtests')).toHaveAttribute(
      'href',
      '/backtests?indicatorSetId=set_1&symbolId=sym_1&from=2026-01-01&to=2026-06-30&stopMethod=atr&takeProfitMethod=rr_target&equity=1000000&riskRate=0.01',
    );
  });

  it('on backtests shows charts and strategy without next', () => {
    render(<AnalysisWorkflowBar current="backtests" context={ctx} />);
    expect(screen.getByTestId('workflow-step-backtests')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByTestId('workflow-to-charts')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-to-strategy')).toBeInTheDocument();
    expect(screen.queryByTestId('workflow-next-strategy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workflow-next-backtests')).not.toBeInTheDocument();
  });
});
