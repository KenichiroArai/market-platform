/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { BacktestRunDto, DailyPriceDto } from '@market/shared-types';
import { BacktestDailyDataPanel } from '../../components/backtest-daily-data-panel';

function makeRun(overrides: Partial<BacktestRunDto> = {}): BacktestRunDto {
  return {
    id: 'run_1',
    userId: 'u_1',
    indicatorSetId: 'set_1',
    signalDefinitionId: null,
    strategyType: 'trendScoreThreshold',
    params: { buyThreshold: 50, sellThreshold: -50 },
    symbolId: 'sym_1',
    fromDate: '2026-01-01',
    toDate: '2026-01-03',
    initialCash: 100000,
    feeMode: 'rate' as const,
    feeRate: 0.001,
    feeFixed: 0,
    slippageRate: 0.001,
    tradeSidePolicy: 'longOnly' as const,
    moneyManagement: null,
    summary: {
      finalEquity: 110000,
      totalReturnRate: 0.1,
      maxDrawdownRate: 0.05,
      totalTrades: 1,
      winRate: 1,
      sharpeRatio: 1.2,
      profitFactor: 2,
      buyHoldReturnRate: 0.08,
      buyHoldFinalEquity: 108000,
    },
    trades: [
      {
        id: 't_1',
        backtestRunId: 'run_1',
        symbolId: 'sym_1',
        entryDate: '2026-01-02',
        exitDate: '2026-01-03',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        side: 'buy',
        grossPnl: 10,
        feeAmount: 0,
        slippageAmount: 0,
        netPnl: 10,
        entryReason: 'score_cross_up',
        exitReason: 'score_cross_down',
        entryScore: 55,
        exitScore: -20,
        entryScoreBreakdown: null,
        exitScoreBreakdown: null,
      },
    ],
    equityPoints: [
      {
        id: 'eq_1',
        backtestRunId: 'run_1',
        date: '2026-01-01',
        cash: 100000,
        positionValue: 0,
        equity: 100000,
        drawdownRate: 0,
        decisionScore: 10,
        scoreBreakdown: {
          groups: { trend: 4 },
          indicators: { rsi: 1.5 },
        },
      },
      {
        id: 'eq_2',
        backtestRunId: 'run_1',
        date: '2026-01-02',
        cash: 0,
        positionValue: 100000,
        equity: 100000,
        drawdownRate: 0,
        decisionScore: 55,
        scoreBreakdown: {
          groups: { trend: 20 },
          indicators: { rsi: 12.5 },
        },
      },
      {
        id: 'eq_3',
        backtestRunId: 'run_1',
        date: '2026-01-03',
        cash: 110000,
        positionValue: 0,
        equity: 110000,
        drawdownRate: 0,
        decisionScore: -20,
        scoreBreakdown: null,
      },
    ],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const price: DailyPriceDto = {
  id: 'p_1',
  symbolId: 'sym_1',
  date: '2026-01-02',
  open: 99,
  high: 101,
  low: 98,
  close: 100,
  volume: 1000,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('BacktestDailyDataPanel', () => {
  it('shows empty message when equity points are missing', () => {
    render(
      <BacktestDailyDataPanel run={makeRun({ equityPoints: [] })} prices={[]} />,
    );
    expect(screen.getByText('日次データがありません')).toBeInTheDocument();
  });

  it('renders summary, detail table, group columns, and zip download', () => {
    const onDownloadZip = jest.fn();
    render(
      <BacktestDailyDataPanel
        run={makeRun()}
        prices={[price]}
        symbolLabel="AAPL — Apple"
        indicatorSetName="スコアセット"
        onDownloadZip={onDownloadZip}
      />,
    );

    expect(screen.getByTestId('daily-data-panel')).toBeInTheDocument();
    expect(screen.getByTestId('daily-symbol')).toHaveTextContent('AAPL — Apple');
    expect(screen.getByTestId('daily-period')).toHaveTextContent('2026-01-01〜2026-01-03');
    expect(screen.getByTestId('daily-strategy')).toBeInTheDocument();
    expect(screen.getByTestId('daily-indicator-set')).toHaveTextContent('スコアセット');
    expect(screen.getByTestId('daily-initial-cash')).toHaveTextContent('100,000');
    expect(screen.getByTestId('summary-cards')).toBeInTheDocument();

    const table = screen.getByTestId('daily-detail-table');
    expect(table).toBeInTheDocument();
    expect(screen.getByText('トレンド')).toBeInTheDocument();
    expect(screen.getByText('RSI')).toBeInTheDocument();
    expect(screen.getByText('buy')).toBeInTheDocument();
    expect(screen.getByText('sell')).toBeInTheDocument();
    expect(screen.getByText('99.00')).toBeInTheDocument();
    expect(screen.getByText('12.5')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('download-backtest-zip'));
    expect(onDownloadZip).toHaveBeenCalledTimes(1);
  });

  it('omits zip button when onDownloadZip is not provided', () => {
    render(<BacktestDailyDataPanel run={makeRun()} prices={[]} />);
    expect(screen.queryByTestId('download-backtest-zip')).not.toBeInTheDocument();
  });

  it('marks buy;sell on same-day round trip', () => {
    const run = makeRun({
      trades: [
        {
          ...makeRun().trades[0]!,
          entryDate: '2026-01-02',
          exitDate: '2026-01-02',
        },
      ],
    });
    render(<BacktestDailyDataPanel run={run} prices={[]} />);
    expect(screen.getByText('buy;sell')).toBeInTheDocument();
  });
});