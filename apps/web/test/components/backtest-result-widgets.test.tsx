import { render, screen } from '@testing-library/react';
import type { BacktestEquityPointDto, BacktestSummaryDto, BacktestTradeDto, DailyPriceDto } from '@market/shared-types';
import { BacktestEquityChart } from '../../components/backtest-equity-chart';
import { BacktestSummaryCards } from '../../components/backtest-summary-cards';
import { BacktestTradesTable } from '../../components/backtest-trades-table';

jest.mock('recharts', () => {
  const React = require('react') as typeof import('react');
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive">{children}</div>
    ),
    LineChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="equity-line-chart">{children}</div>
    ),
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Line: () => null,
  };
});

const summary: BacktestSummaryDto = {
  finalEquity: 110000,
  totalReturnRate: 0.1,
  maxDrawdownRate: 0.05,
  totalTrades: 2,
  winRate: 0.5,
  sharpeRatio: 1.25,
  profitFactor: 1.8,
  buyHoldReturnRate: 0.08,
  buyHoldFinalEquity: 108000,
};

const trade: BacktestTradeDto = {
  id: 't_1',
  backtestRunId: 'run_1',
  symbolId: 'sym_1',
  entryDate: '2026-01-02',
  exitDate: '2026-01-05',
  entryPrice: 100,
  exitPrice: 110,
  quantity: 1,
  side: 'buy',
  grossPnl: 10,
  feeAmount: 0,
  slippageAmount: 0,
  netPnl: 10,
  entryReason: 'sma_golden_cross',
  exitReason: 'sma_dead_cross',
  entryScore: null,
  exitScore: null,
};

const equity: BacktestEquityPointDto = {
  id: 'e_1',
  backtestRunId: 'run_1',
  date: '2026-01-02',
  cash: 0,
  positionValue: 100,
  equity: 100,
  drawdownRate: 0,
};

const price: DailyPriceDto = {
  id: 'p_1',
  symbolId: 'sym_1',
  date: '2026-01-02',
  open: 100,
  high: 100,
  low: 100,
  close: 100,
  volume: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('BacktestSummaryCards', () => {
  it('renders key metrics', () => {
    render(<BacktestSummaryCards summary={summary} />);
    expect(screen.getByTestId('summary-cards')).toBeInTheDocument();
    expect(screen.getByText('リターン')).toBeInTheDocument();
    expect(screen.getByText('10.00%')).toBeInTheDocument();
    expect(screen.getByText('Sharpe')).toBeInTheDocument();
  });
});

describe('BacktestTradesTable', () => {
  it('shows empty message', () => {
    render(<BacktestTradesTable trades={[]} />);
    expect(screen.getByText('取引はありません')).toBeInTheDocument();
  });

  it('renders trade rows', () => {
    render(<BacktestTradesTable trades={[trade]} />);
    expect(screen.getByTestId('trades-table')).toBeInTheDocument();
    expect(screen.getByText('2026-01-02')).toBeInTheDocument();
    expect(screen.getByText('10.00')).toBeInTheDocument();
    expect(screen.getByText('エントリー日')).toBeInTheDocument();
    expect(screen.getByText('買い判断')).toBeInTheDocument();
    expect(screen.getByTestId('trade-entry-reason-t_1')).toHaveTextContent('SMAゴールデンクロス');
    expect(screen.getByTestId('trade-exit-reason-t_1')).toHaveTextContent('SMAデッドクロス');
  });

  it('leaves reason cells blank when codes are null', () => {
    render(
      <BacktestTradesTable
        trades={[
          {
            ...trade,
            id: 't_blank',
            entryReason: null,
            exitReason: null,
            entryScore: null,
            exitScore: null,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('trade-entry-reason-t_blank')).toHaveTextContent('');
    expect(screen.getByTestId('trade-exit-reason-t_blank')).toHaveTextContent('');
  });

  it('appends score when decision scores are present', () => {
    render(
      <BacktestTradesTable
        trades={[
          {
            ...trade,
            id: 't_rsi',
            entryReason: 'rsi_oversold',
            exitReason: 'rsi_overbought',
            entryScore: 28.4,
            exitScore: 72.1,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('trade-entry-reason-t_rsi')).toHaveTextContent(
      'RSI売られすぎ（28.4）',
    );
    expect(screen.getByTestId('trade-exit-reason-t_rsi')).toHaveTextContent(
      'RSI買われすぎ（72.1）',
    );
  });
});

describe('BacktestEquityChart', () => {
  it('shows empty message', () => {
    render(<BacktestEquityChart equityPoints={[]} prices={[]} initialCash={1000} />);
    expect(screen.getByText('エクイティデータがありません')).toBeInTheDocument();
  });

  it('renders chart', () => {
    render(
      <BacktestEquityChart equityPoints={[equity]} prices={[price]} initialCash={1000} />,
    );
    expect(screen.getByTestId('equity-chart')).toBeInTheDocument();
    expect(screen.getByTestId('equity-line-chart')).toBeInTheDocument();
  });

  it('handles missing or zero first close for Buy&Hold', () => {
    render(
      <BacktestEquityChart
        equityPoints={[equity]}
        prices={[{ ...price, close: 0 }]}
        initialCash={1000}
      />,
    );
    expect(screen.getByTestId('equity-chart')).toBeInTheDocument();

    render(
      <BacktestEquityChart equityPoints={[equity]} prices={[]} initialCash={1000} />,
    );
    expect(screen.getAllByTestId('equity-chart').length).toBeGreaterThanOrEqual(1);
  });
});
