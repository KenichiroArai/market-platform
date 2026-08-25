/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BacktestsPage from '../../../../app/(app)/backtests/page';
import {
  ApiClientError,
  createSignalDefinition,
  deleteSignalDefinition,
  fetchBacktestRuns,
  fetchSignalDefinitions,
  fetchSymbolPrices,
  fetchSymbols,
  optimizeBacktest,
  runBacktest,
} from '../../../../lib/api-client';

jest.mock('../../../../lib/api-client', () => ({
  fetchSignalDefinitions: jest.fn(),
  fetchBacktestRuns: jest.fn(),
  fetchSymbols: jest.fn(),
  fetchSymbolPrices: jest.fn(),
  createSignalDefinition: jest.fn(),
  deleteSignalDefinition: jest.fn(),
  runBacktest: jest.fn(),
  optimizeBacktest: jest.fn(),
  ApiClientError: class ApiClientError extends Error {
    constructor(
      public statusCode: number,
      public code: string,
      message: string,
    ) {
      super(message);
      this.name = 'ApiClientError';
    }
  },
}));

jest.mock('../../../../components/price-chart', () => ({
  PriceChart: ({ loading }: { loading?: boolean }) => (
    <div data-testid="price-chart-stub">{loading ? 'loading' : 'ready'}</div>
  ),
}));

jest.mock('../../../../components/backtest-summary-cards', () => ({
  BacktestSummaryCards: () => <div data-testid="summary-cards-stub" />,
}));

jest.mock('../../../../components/backtest-equity-chart', () => ({
  BacktestEquityChart: () => <div data-testid="equity-chart-stub" />,
}));

jest.mock('../../../../components/backtest-trades-table', () => ({
  BacktestTradesTable: () => <div data-testid="trades-table-stub" />,
}));

describe('BacktestsPage', () => {
  const symbol = {
    id: 'sym_1',
    ticker: 'AAPL',
    market: 'US' as const,
    name: 'Apple',
    currency: 'USD',
    exchange: 'NASDAQ',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const signal = {
    id: 'sig_1',
    userId: 'u_1',
    name: 'SMA 5/20',
    strategyType: 'smaCross' as const,
    params: { shortPeriod: 5, longPeriod: 20 },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const run = {
    id: 'run_1',
    userId: 'u_1',
    signalDefinitionId: 'sig_1',
    symbolId: 'sym_1',
    fromDate: '2026-01-01',
    toDate: '2026-06-30',
    initialCash: 100000,
    feeRate: 0.001,
    slippageRate: 0.001,
    summary: {
      finalEquity: 101000,
      totalReturnRate: 0.01,
      maxDrawdownRate: 0.01,
      totalTrades: 1,
      winRate: 1,
      sharpeRatio: 0.5,
      profitFactor: 1.2,
      buyHoldReturnRate: 0.02,
      buyHoldFinalEquity: 102000,
    },
    trades: [],
    equityPoints: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchSymbolPrices as jest.Mock).mockResolvedValue([]);
  });

  it('loads data and supports create/run/delete/optimize', async () => {
    (fetchSignalDefinitions as jest.Mock).mockResolvedValue([signal]);
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([run]);
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    (createSignalDefinition as jest.Mock)
      .mockResolvedValueOnce({
        ...signal,
        id: 'sig_2',
        name: 'New',
      })
      .mockResolvedValueOnce({
        ...signal,
        id: 'sig_opt',
        name: 'SMA 5/20',
        params: { shortPeriod: 5, longPeriod: 20 },
      });
    (runBacktest as jest.Mock).mockResolvedValue({ ...run, id: 'run_2' });
    (deleteSignalDefinition as jest.Mock).mockResolvedValue(null);
    (optimizeBacktest as jest.Mock).mockResolvedValue({
      results: [
        {
          shortPeriod: 5,
          longPeriod: 20,
          summary: run.summary,
        },
      ],
    });

    render(<BacktestsPage />);
    await waitFor(() => {
      expect(screen.getByText('SMA 5/20 (smaCross)')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'シグナル / バックテスト' })).toBeInTheDocument();
    expect(screen.getByText(/リターン=1.00%/)).toBeInTheDocument();
    expect(screen.getByTestId('summary-cards-stub')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '詳細チャート' })).toHaveAttribute(
      'href',
      '/charts?symbolId=sym_1&from=2026-01-01&to=2026-06-30',
    );

    fireEvent.change(screen.getByPlaceholderText('シグナル名'), { target: { value: 'New' } });
    fireEvent.submit(screen.getByPlaceholderText('シグナル名').closest('form')!);
    await waitFor(() => expect(createSignalDefinition).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('開始資金'), { target: { value: '200000' } });
    fireEvent.submit(screen.getByRole('button', { name: '実行' }).closest('form')!);
    await waitFor(() =>
      expect(runBacktest).toHaveBeenCalledWith(
        expect.objectContaining({ initialCash: 200000 }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'SMA 最適化' }));
    await waitFor(() => expect(optimizeBacktest).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('SMA 最適化結果')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '適用' }));
    await waitFor(() => expect(createSignalDefinition).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]);
    await waitFor(() => expect(deleteSignalDefinition).toHaveBeenCalled());
  });

  it('shows ApiClientError on load failure', async () => {
    (fetchSignalDefinitions as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', 'boom'));
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([]);
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    render(<BacktestsPage />);
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });

  it('shows fallback create error', async () => {
    (fetchSignalDefinitions as jest.Mock).mockResolvedValue([]);
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([]);
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    (createSignalDefinition as jest.Mock).mockRejectedValue(new Error('x'));
    render(<BacktestsPage />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: '銘柄を追加' })).toHaveAttribute('href', '/symbols'),
    );
    expect(screen.getByText('まだ結果がありません')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('シグナル名'), { target: { value: 'A' } });
    fireEvent.submit(screen.getByPlaceholderText('シグナル名').closest('form')!);
    await waitFor(() => expect(screen.getByText('シグナル作成に失敗しました')).toBeInTheDocument());
  });
});
