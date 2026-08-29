/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import {
  BacktestEquityHelp,
  EQUITY_CURVE_HELP_TEXT,
} from '../../components/backtest-equity-help';

describe('BacktestEquityHelp', () => {
  it('renders the help icon', () => {
    render(<BacktestEquityHelp />);
    expect(screen.getByTestId('equity-curve-help-icon')).toBeInTheDocument();
    expect(screen.getByLabelText('エクイティカーブの説明')).toBeInTheDocument();
  });

  it('shows EQUITY_CURVE_HELP_TEXT on hover', () => {
    render(<BacktestEquityHelp />);
    expect(screen.queryByTestId('equity-curve-tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId('equity-curve-help'));
    expect(screen.getByTestId('equity-curve-tooltip')).toHaveTextContent(EQUITY_CURVE_HELP_TEXT);
    fireEvent.mouseLeave(screen.getByTestId('equity-curve-help'));
    expect(screen.queryByTestId('equity-curve-tooltip')).not.toBeInTheDocument();
  });
});
