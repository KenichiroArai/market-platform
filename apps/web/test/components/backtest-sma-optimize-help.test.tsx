/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import {
  BacktestSmaOptimizeHelp,
  SMA_OPTIMIZE_HELP_TEXT,
} from '../../components/backtest-sma-optimize-help';

describe('BacktestSmaOptimizeHelp', () => {
  it('shows tooltip on hover and hides on leave', () => {
    render(
      <BacktestSmaOptimizeHelp>
        <button type="button">SMA 最適化</button>
      </BacktestSmaOptimizeHelp>,
    );
    expect(screen.queryByTestId('sma-optimize-tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId('sma-optimize-help'));
    expect(screen.getByTestId('sma-optimize-tooltip')).toHaveTextContent(SMA_OPTIMIZE_HELP_TEXT);
    fireEvent.mouseLeave(screen.getByTestId('sma-optimize-help'));
    expect(screen.queryByTestId('sma-optimize-tooltip')).not.toBeInTheDocument();
  });
});
