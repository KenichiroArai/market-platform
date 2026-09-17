/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AnalysisHubPage from '../../../../app/(app)/analysis/page';
import { ApiClientError, fetchSymbols } from '../../../../lib/api-client';

jest.mock('../../../../lib/api-client', () => ({
  fetchSymbols: jest.fn(),
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

const symbol = {
  id: 'sym_1',
  ticker: 'AAPL',
  market: 'US' as const,
  name: 'Apple Inc.',
  currency: 'USD',
  exchange: 'NASDAQ',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AnalysisHubPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol]);
    const { useSearchParams } = require('../../../../test/mocks/next-navigation');
    useSearchParams.mockReturnValue(new URLSearchParams());
  });

  it('renders hub links with context and future items', async () => {
    render(<AnalysisHubPage />);
    await waitFor(() => expect(screen.getByTestId('analysis-hub-symbol')).toHaveValue('sym_1'));
    expect(screen.getByRole('heading', { name: '分析' })).toBeInTheDocument();
    expect(screen.getByTestId('analysis-hub-charts-link').getAttribute('href')).toContain(
      'symbolId=sym_1',
    );
    expect(screen.getByTestId('analysis-hub-strategy-link').getAttribute('href')).toContain(
      'symbolId=sym_1',
    );
    expect(screen.getByTestId('analysis-hub-backtests-link').getAttribute('href')).toContain(
      'symbolId=sym_1',
    );
    expect(screen.getByTestId('analysis-hub-flow')).toBeInTheDocument();
    expect(screen.getByText('テクニカル分析（詳細）')).toBeInTheDocument();
    expect(screen.getByText('トレンド分析')).toBeInTheDocument();
    expect(screen.getByText('ファンダメンタル分析')).toBeInTheDocument();
  });

  it('applies query params for symbol and period', async () => {
    const { useSearchParams } = require('../../../../test/mocks/next-navigation');
    useSearchParams.mockReturnValue(
      new URLSearchParams({
        symbolId: 'sym_2',
        from: '2026-01-01',
        to: '2026-06-30',
      }),
    );
    (fetchSymbols as jest.Mock).mockResolvedValue([
      symbol,
      { ...symbol, id: 'sym_2', ticker: 'MSFT', name: 'Microsoft' },
    ]);
    render(<AnalysisHubPage />);
    await waitFor(() => expect(screen.getByTestId('analysis-hub-symbol')).toHaveValue('sym_2'));
    expect(screen.getByTestId('analysis-hub-from')).toHaveValue('2026-01-01');
    expect(screen.getByTestId('analysis-hub-to')).toHaveValue('2026-06-30');
    expect(screen.getByTestId('analysis-hub-summary')).toHaveTextContent('MSFT');
    expect(screen.getByTestId('analysis-hub-charts-link')).toHaveAttribute(
      'href',
      '/charts?symbolId=sym_2&from=2026-01-01&to=2026-06-30',
    );
  });

  it('updates links when symbol and dates change', async () => {
    const replaceState = jest.spyOn(window.history, 'replaceState').mockImplementation(() => undefined);
    (fetchSymbols as jest.Mock).mockResolvedValue([
      symbol,
      { ...symbol, id: 'sym_2', ticker: 'MSFT', name: 'Microsoft' },
    ]);
    render(<AnalysisHubPage />);
    await waitFor(() => expect(screen.getByTestId('analysis-hub-symbol')).toHaveValue('sym_1'));
    fireEvent.change(screen.getByTestId('analysis-hub-symbol'), { target: { value: 'sym_2' } });
    fireEvent.change(screen.getByTestId('analysis-hub-from'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByTestId('analysis-hub-to'), { target: { value: '2025-12-31' } });
    expect(screen.getByTestId('analysis-hub-strategy-link')).toHaveAttribute(
      'href',
      '/strategy?symbolId=sym_2&from=2025-01-01&to=2025-12-31',
    );
    expect(replaceState).toHaveBeenCalled();
    replaceState.mockRestore();
  });

  it('shows ApiClientError when symbols fail', async () => {
    (fetchSymbols as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', '銘柄エラー'));
    render(<AnalysisHubPage />);
    await waitFor(() =>
      expect(screen.getByTestId('analysis-hub-error')).toHaveTextContent('銘柄エラー'),
    );
  });

  it('shows fallback when symbol fetch fails with unknown error', async () => {
    (fetchSymbols as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<AnalysisHubPage />);
    await waitFor(() =>
      expect(screen.getByTestId('analysis-hub-error')).toHaveTextContent(
        '銘柄の取得に失敗しました',
      ),
    );
  });

  it('handles empty symbol list', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    render(<AnalysisHubPage />);
    await waitFor(() => expect(screen.getByTestId('analysis-hub-symbol')).toBeInTheDocument());
    expect(screen.getByTestId('analysis-hub-symbol')).toHaveValue('');
    expect(screen.queryByTestId('analysis-hub-summary')).not.toBeInTheDocument();
  });

  it('falls back to first symbol when query symbol is unknown', async () => {
    const { useSearchParams } = require('../../../../test/mocks/next-navigation');
    useSearchParams.mockReturnValue(new URLSearchParams({ symbolId: 'missing' }));
    render(<AnalysisHubPage />);
    await waitFor(() => expect(screen.getByTestId('analysis-hub-symbol')).toHaveValue('sym_1'));
  });

  it('ignores symbol fetch after unmount', async () => {
    let resolveSymbols!: (value: typeof symbol[]) => void;
    (fetchSymbols as jest.Mock).mockReturnValue(
      new Promise<typeof symbol[]>((resolve) => {
        resolveSymbols = resolve;
      }),
    );
    const { unmount } = render(<AnalysisHubPage />);
    unmount();
    resolveSymbols([symbol]);
    await waitFor(() => {
      expect(screen.queryByTestId('analysis-hub-symbol')).not.toBeInTheDocument();
    });
  });

  it('ignores symbol fetch error after unmount', async () => {
    let rejectSymbols!: (reason?: unknown) => void;
    (fetchSymbols as jest.Mock).mockReturnValue(
      new Promise<typeof symbol[]>((_resolve, reject) => {
        rejectSymbols = reject;
      }),
    );
    const { unmount } = render(<AnalysisHubPage />);
    unmount();
    rejectSymbols(new Error('late'));
    await waitFor(() => {
      expect(screen.queryByTestId('analysis-hub-error')).not.toBeInTheDocument();
    });
  });
});
