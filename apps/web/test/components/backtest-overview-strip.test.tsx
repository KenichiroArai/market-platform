/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { BacktestOverviewStrip } from '../../components/backtest-overview-strip';

describe('BacktestOverviewStrip', () => {
  const summary = {
    finalEquity: 101000,
    totalReturnRate: 0.01,
    maxDrawdownRate: 0.02,
    totalTrades: 3,
    winRate: 0.5,
    sharpeRatio: 0.5,
    profitFactor: 1.2,
    buyHoldReturnRate: 0.02,
    buyHoldFinalEquity: 102000,
  };

  it('shows symbol label and empty message when no run', () => {
    render(
      <BacktestOverviewStrip
        ticker="AAPL"
        name="Apple"
        fromDate={null}
        toDate={null}
        summary={null}
      />,
    );
    expect(screen.getByTestId('backtest-overview-symbol')).toHaveTextContent('AAPL — Apple');
    expect(screen.getByTestId('backtest-overview-empty')).toHaveTextContent(
      '実行結果がありません',
    );
  });

  it('shows ticker only when name is null and metrics when summary exists', () => {
    render(
      <BacktestOverviewStrip
        ticker="7203"
        name={null}
        fromDate="2026-01-01"
        toDate="2026-06-30"
        summary={summary}
      />,
    );
    expect(screen.getByTestId('backtest-overview-symbol')).toHaveTextContent('7203');
    expect(screen.getByTestId('backtest-overview-metrics')).toHaveTextContent('リターン 1.00%');
    expect(screen.getByTestId('backtest-overview-metrics')).toHaveTextContent('勝率 50.00%');
    expect(screen.getByTestId('backtest-overview-metrics')).toHaveTextContent('最大DD 2.00%');
    expect(screen.getByTestId('backtest-overview-metrics')).toHaveTextContent('取引数 3');
  });

  it('shows 銘柄未選択 when ticker is null', () => {
    render(
      <BacktestOverviewStrip
        ticker={null}
        name={null}
        fromDate={null}
        toDate={null}
        summary={null}
      />,
    );
    expect(screen.getByTestId('backtest-overview-symbol')).toHaveTextContent('銘柄未選択');
  });
});
