import { render, screen } from '@testing-library/react';
import type { BacktestTradeDto, DailyPriceDto } from '@market/shared-types';
import { PriceChart } from '../../components/price-chart';

jest.mock('recharts', () => {
  const React = require('react') as typeof import('react');
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive">{children}</div>
    ),
    ComposedChart: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="line-chart">{children}</div>
    ),
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Line: () => null,
    Scatter: ({ name }: { name?: string }) => <div data-testid={`scatter-${name}`} />,
  };
});

const price: DailyPriceDto = {
  id: 'price_1',
  symbolId: 'sym_1',
  date: '2026-01-02',
  open: 100,
  high: 105,
  low: 99,
  close: 103,
  volume: 1000,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const trade: BacktestTradeDto = {
  id: 't_1',
  backtestRunId: 'run_1',
  symbolId: 'sym_1',
  entryDate: '2026-01-02',
  exitDate: '2026-01-02',
  entryPrice: 100,
  exitPrice: 103,
  quantity: 1,
  side: 'buy',
  grossPnl: 3,
  feeAmount: 0,
  slippageAmount: 0,
  netPnl: 3,
};

describe('PriceChart', () => {
  it('shows loading message', () => {
    render(<PriceChart prices={[]} loading />);
    expect(screen.getByText('価格を読み込み中…')).toBeInTheDocument();
  });

  it('shows empty message when there are no prices', () => {
    render(<PriceChart prices={[]} />);
    expect(screen.getByText('この期間の価格データがありません')).toBeInTheDocument();
  });

  it('renders chart when prices are present', () => {
    render(<PriceChart prices={[price]} />);
    expect(screen.getByTestId('price-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders buy/sell scatter series when trades are present', () => {
    render(<PriceChart prices={[price]} trades={[trade]} />);
    expect(screen.getByTestId('scatter-▲Buy')).toBeInTheDocument();
    expect(screen.getByTestId('scatter-▼Sell')).toBeInTheDocument();
  });
});
