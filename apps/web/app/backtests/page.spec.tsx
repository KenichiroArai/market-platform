/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import BacktestsPage from './page';
import {
  ApiClientError,
  createSignalDefinition,
  deleteSignalDefinition,
  fetchBacktestRuns,
  fetchSignalDefinitions,
  fetchSymbolPrices,
  fetchSymbols,
  runBacktest,
} from '../../lib/api-client';
import { getAccessToken } from '../../lib/auth-token';

jest.mock('../../lib/api-client', () => ({
  fetchSignalDefinitions: jest.fn(),
  fetchBacktestRuns: jest.fn(),
  fetchSymbols: jest.fn(),
  fetchSymbolPrices: jest.fn(),
  createSignalDefinition: jest.fn(),
  deleteSignalDefinition: jest.fn(),
  runBacktest: jest.fn(),
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

jest.mock('../../components/price-chart', () => ({
  PriceChart: ({ loading }: { loading?: boolean }) => (
    <div data-testid="price-chart-stub">{loading ? 'loading' : 'ready'}</div>
  ),
}));

jest.mock('../../lib/auth-token', () => ({
  getAccessToken: jest.fn(),
}));

describe('BacktestsPage', () => {
  const replace = jest.fn();
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
    },
    trades: [],
    equityPoints: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    (fetchSymbolPrices as jest.Mock).mockResolvedValue([]);
  });

  it('redirects when token missing', async () => {
    (getAccessToken as jest.Mock).mockReturnValue(null);
    render(<BacktestsPage />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });

  it('loads data and supports create/run/delete', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchSignalDefinitions as jest.Mock).mockResolvedValue([signal]);
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([run]);
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    (createSignalDefinition as jest.Mock).mockResolvedValue({ ...signal, id: 'sig_2', name: 'New' });
    (runBacktest as jest.Mock).mockResolvedValue({ ...run, id: 'run_2' });
    (deleteSignalDefinition as jest.Mock).mockResolvedValue(null);

    render(<BacktestsPage />);
    await waitFor(() => {
      expect(screen.getByText('SMA 5/20 (smaCross)')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('シグナル名'), { target: { value: 'New' } });
    fireEvent.submit(screen.getByPlaceholderText('シグナル名').closest('form')!);
    await waitFor(() => expect(createSignalDefinition).toHaveBeenCalled());

    fireEvent.submit(screen.getByRole('button', { name: '実行' }).closest('form')!);
    await waitFor(() => expect(runBacktest).toHaveBeenCalled());

    fireEvent.click(screen.getAllByRole('button', { name: '削除' })[0]);
    await waitFor(() => expect(deleteSignalDefinition).toHaveBeenCalled());
  });

  it('shows ApiClientError on load failure', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchSignalDefinitions as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', 'boom'));
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([]);
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    render(<BacktestsPage />);
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });

  it('shows fallback create error', async () => {
    (getAccessToken as jest.Mock).mockReturnValue('tok');
    (fetchSignalDefinitions as jest.Mock).mockResolvedValue([]);
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([]);
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    (createSignalDefinition as jest.Mock).mockRejectedValue(new Error('x'));
    render(<BacktestsPage />);
    await waitFor(() => expect(screen.getByText('まだ結果がありません')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('シグナル名'), { target: { value: 'A' } });
    fireEvent.submit(screen.getByPlaceholderText('シグナル名').closest('form')!);
    await waitFor(() => expect(screen.getByText('シグナル作成に失敗しました')).toBeInTheDocument());
  });
});
