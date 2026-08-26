/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSearchParams } from 'next/navigation';
import BacktestsPage from '../../../../app/(app)/backtests/page';
import {
  ApiClientError,
  fetchBacktestRuns,
  fetchIndicatorSets,
  fetchSymbolPrices,
  fetchSymbols,
  optimizeBacktest,
  runBacktest,
} from '../../../../lib/api-client';

jest.mock('../../../../lib/api-client', () => ({
  fetchIndicatorSets: jest.fn(),
  fetchBacktestRuns: jest.fn(),
  fetchSymbols: jest.fn(),
  fetchSymbolPrices: jest.fn(),
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
  const capableSet = {
    id: 'set_1',
    userId: 'u_1',
    name: 'SMAクロス',
    indicatorIds: ['sma25', 'sma75'] as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const incapableSet = {
    id: 'set_2',
    userId: 'u_1',
    name: '表示のみ',
    indicatorIds: ['bb', 'volume'] as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const run = {
    id: 'run_1',
    userId: 'u_1',
    indicatorSetId: 'set_1',
    signalDefinitionId: null,
    strategyType: 'smaCross' as const,
    params: { shortPeriod: 25, longPeriod: 75 },
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
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    (fetchSymbolPrices as jest.Mock).mockResolvedValue([]);
  });

  it('loads indicator sets and supports run/optimize', async () => {
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([capableSet, incapableSet]);
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([run]);
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    (runBacktest as jest.Mock).mockResolvedValue({ ...run, id: 'run_2' });
    (optimizeBacktest as jest.Mock).mockResolvedValue({
      results: [
        {
          shortPeriod: 25,
          longPeriod: 75,
          summary: run.summary,
        },
      ],
    });

    render(<BacktestsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('indicator-set-select')).toHaveValue('set_1');
    });
    expect(screen.getByRole('heading', { name: 'バックテスト' })).toBeInTheDocument();
    expect(screen.getByTestId('selected-set-rule-preview')).toHaveTextContent('バックテスト用');
    expect(screen.getByRole('link', { name: '指標を編集' })).toHaveAttribute('href', '/charts');
    expect(screen.getByText(/リターン=1.00%/)).toBeInTheDocument();
    expect(screen.getByTestId('summary-cards-stub')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '詳細チャート' })).toHaveAttribute(
      'href',
      '/charts?symbolId=sym_1&from=2026-01-01&to=2026-06-30',
    );

    fireEvent.change(screen.getByLabelText('開始資金'), { target: { value: '200000' } });
    fireEvent.submit(screen.getByRole('button', { name: '実行' }).closest('form')!);
    await waitFor(() =>
      expect(runBacktest).toHaveBeenCalledWith(
        expect.objectContaining({
          indicatorSetId: 'set_1',
          initialCash: 200000,
        }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'SMA 最適化' }));
    await waitFor(() => expect(optimizeBacktest).toHaveBeenCalled());
    expect(optimizeBacktest).toHaveBeenCalledWith(
      expect.not.objectContaining({ shortMin: expect.anything() }),
    );
    await waitFor(() => expect(screen.getByText('SMA 最適化結果')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '適用' })).not.toBeInTheDocument();
  });

  it('preselects indicatorSetId from search params', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('indicatorSetId=set_2'),
    );
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([capableSet, incapableSet]);
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([]);
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);

    render(<BacktestsPage />);
    await waitFor(() => {
      expect(screen.getByTestId('indicator-set-select')).toHaveValue('set_2');
    });
    expect(screen.getByRole('button', { name: '実行' })).toBeDisabled();
    expect(screen.getByTestId('selected-set-rule-preview')).toHaveTextContent('未確定');
  });

  it('shows ApiClientError on load failure', async () => {
    (fetchIndicatorSets as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', 'boom'));
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([]);
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    render(<BacktestsPage />);
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });

  it('shows empty state when no symbols or runs', async () => {
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([]);
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([]);
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    render(<BacktestsPage />);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: '銘柄を追加' })).toHaveAttribute('href', '/symbols'),
    );
    expect(screen.getByText('まだ結果がありません')).toBeInTheDocument();
  });
});
