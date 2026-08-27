import { fireEvent, render, screen } from '@testing-library/react';
import { BacktestChartDisplayModeSwitch } from '../../components/backtest-chart-display-mode';
import { BacktestRunConditions } from '../../components/backtest-run-conditions';

describe('BacktestRunConditions', () => {
  it('renders strategy label and rates from run snapshot', () => {
    render(
      <BacktestRunConditions
        strategyType="smaCross"
        params={{ shortPeriod: 25, longPeriod: 75 }}
        indicatorSetName="標準セット"
        fromDate="2026-01-01"
        toDate="2026-06-30"
        initialCash={100000}
        feeRate={0.001}
        slippageRate={0.001}
      />,
    );
    expect(screen.getByTestId('backtest-run-conditions')).toBeInTheDocument();
    expect(screen.getByTestId('condition-strategy')).toHaveTextContent('SMAクロス 25/75');
    expect(screen.getByTestId('condition-indicator-set')).toHaveTextContent('標準セット');
    expect(screen.getByTestId('condition-period')).toHaveTextContent('2026-01-01〜2026-06-30');
    expect(screen.getByTestId('condition-initial-cash')).toHaveTextContent('100,000');
    expect(screen.getByTestId('condition-fee-rate')).toHaveTextContent('0.10%');
    expect(screen.getByTestId('condition-slippage-rate')).toHaveTextContent('0.10%');
  });

  it('leaves blanks when values are missing', () => {
    render(
      <BacktestRunConditions
        strategyType={null}
        params={null}
        indicatorSetName={null}
        fromDate={null}
        toDate={null}
        initialCash={null}
        feeRate={null}
        slippageRate={null}
      />,
    );
    expect(screen.getByTestId('condition-strategy')).toHaveTextContent('');
    expect(screen.getByTestId('condition-indicator-set')).toHaveTextContent('');
    expect(screen.getByTestId('condition-period')).toHaveTextContent('');
    expect(screen.getByTestId('condition-initial-cash')).toHaveTextContent('');
    expect(screen.getByTestId('condition-fee-rate')).toHaveTextContent('');
  });

  it('formats macd and rsi strategy labels', () => {
    const { rerender } = render(
      <BacktestRunConditions
        strategyType="macdCross"
        params={{ fast: 12, slow: 26, signal: 9 }}
        indicatorSetName={null}
        fromDate="2026-01-01"
        toDate={null}
        initialCash={null}
        feeRate={null}
        slippageRate={null}
      />,
    );
    expect(screen.getByTestId('condition-strategy')).toHaveTextContent('MACDクロス 12/26/9');
    expect(screen.getByTestId('condition-period')).toHaveTextContent('2026-01-01');

    rerender(
      <BacktestRunConditions
        strategyType="rsiThreshold"
        params={{ period: 14, lower: 30, upper: 70 }}
        indicatorSetName={null}
        fromDate={null}
        toDate="2026-06-30"
        initialCash={null}
        feeRate={null}
        slippageRate={null}
      />,
    );
    expect(screen.getByTestId('condition-strategy')).toHaveTextContent(
      'RSI閾値 14（≤30 / ≥70）',
    );
    expect(screen.getByTestId('condition-period')).toHaveTextContent('2026-06-30');
  });
});

describe('BacktestChartDisplayModeSwitch', () => {
  it('toggles between base and indicators modes', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <BacktestChartDisplayModeSwitch mode="base" onChange={onChange} />,
    );
    expect(screen.getByTestId('chart-mode-base')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('chart-mode-indicators'));
    expect(onChange).toHaveBeenCalledWith('indicators');

    rerender(<BacktestChartDisplayModeSwitch mode="indicators" onChange={onChange} />);
    expect(screen.getByTestId('chart-mode-indicators')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('chart-mode-base'));
    expect(onChange).toHaveBeenCalledWith('base');
  });
});
