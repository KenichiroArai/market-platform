/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ChartsPage from './page';
import {
  ApiClientError,
  fetchSymbolIndicators,
  fetchSymbolPrices,
  fetchSymbols,
  fetchWatchlists,
} from '../../../lib/api-client';

jest.mock('../../../lib/api-client', () => ({
  fetchSymbols: jest.fn(),
  fetchWatchlists: jest.fn(),
  fetchSymbolPrices: jest.fn(),
  fetchSymbolIndicators: jest.fn(),
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

jest.mock('../../../components/analysis-chart', () => ({
  DEFAULT_OVERLAYS: { sma: true, ema: true, rsi: true, macd: true },
  AnalysisChart: ({ loading }: { loading?: boolean }) => (
    <div data-testid="analysis-chart-stub">{loading ? 'loading' : 'ready'}</div>
  ),
}));

describe('ChartsPage', () => {
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
  const symbol2 = {
    ...symbol,
    id: 'sym_2',
    ticker: 'MSFT',
    name: 'Microsoft',
  };
  const watchlist = {
    id: 'wl_1',
    userId: 'u_1',
    name: 'Tech',
    items: [
      {
        id: 'item_1',
        watchlistId: 'wl_1',
        symbolId: 'sym_1',
        symbol,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchSymbols as jest.Mock).mockResolvedValue([symbol, symbol2]);
    (fetchWatchlists as jest.Mock).mockResolvedValue([watchlist]);
    (fetchSymbolPrices as jest.Mock).mockResolvedValue([
      {
        id: 'p1',
        symbolId: 'sym_1',
        date: '2026-01-02',
        open: 1,
        high: 2,
        low: 1,
        close: 1.5,
        volume: 10,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    (fetchSymbolIndicators as jest.Mock).mockResolvedValue({
      symbolId: 'sym_1',
      indicators: [],
      points: [{ date: '2026-01-02', sma: 1.2 }],
    });
  });

  it('loads symbols and chart data', async () => {
    render(<ChartsPage />);
    expect(screen.getByText('読み込み中…')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('analysis-chart-stub')).toHaveTextContent('ready'),
    );
    expect(fetchSymbolPrices).toHaveBeenCalledWith('sym_1', {
      from: '2026-01-01',
      to: '2026-06-30',
      interval: '1d',
    });
    expect(fetchSymbolIndicators).toHaveBeenCalledWith(
      'sym_1',
      expect.objectContaining({ indicators: 'sma,ema,rsi,macd', interval: '1d' }),
    );
  });

  it('shows load error from ApiClientError', async () => {
    (fetchSymbols as jest.Mock).mockRejectedValue(
      new ApiClientError(401, 'AUTH_UNAUTHORIZED', 'unauthorized'),
    );
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByText('unauthorized')).toBeInTheDocument());
  });

  it('shows generic load error for unknown failures', async () => {
    (fetchSymbols as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByText('読み込みに失敗しました')).toBeInTheDocument());
  });

  it('filters symbols by search and switches interval/overlays', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('symbol-select')).toBeInTheDocument());

    // ウォッチリストを「すべて」にして両銘柄を候補に
    fireEvent.change(screen.getByTestId('watchlist-select'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('symbol-search'), { target: { value: 'msft' } });
    await waitFor(() => {
      const select = screen.getByTestId('symbol-select') as HTMLSelectElement;
      expect(select.options).toHaveLength(1);
      expect(select.options[0]?.textContent).toContain('MSFT');
    });

    fireEvent.change(screen.getByTestId('symbol-select'), { target: { value: 'sym_2' } });

    const fromInput = screen.getByLabelText('From');
    const toInput = screen.getByLabelText('To');
    fireEvent.change(fromInput, { target: { value: '2026-02-01' } });
    fireEvent.change(toInput, { target: { value: '2026-05-31' } });

    fireEvent.click(screen.getByLabelText('週足'));
    await waitFor(() =>
      expect(fetchSymbolPrices).toHaveBeenCalledWith(
        'sym_2',
        expect.objectContaining({
          interval: '1w',
          from: '2026-02-01',
          to: '2026-05-31',
        }),
      ),
    );

    // 日足に戻す（ラジオ onChange の両枝をカバー）
    fireEvent.click(screen.getByLabelText('日足'));
    await waitFor(() =>
      expect(fetchSymbolPrices).toHaveBeenCalledWith(
        'sym_2',
        expect.objectContaining({ interval: '1d' }),
      ),
    );

    fireEvent.click(screen.getByTestId('overlay-sma'));
    fireEvent.click(screen.getByTestId('overlay-ema'));
    fireEvent.click(screen.getByTestId('overlay-rsi'));
    fireEvent.click(screen.getByTestId('overlay-macd'));
    await waitFor(() => {
      const lastPricesCall = (fetchSymbolPrices as jest.Mock).mock.calls.at(-1);
      expect(lastPricesCall?.[0]).toBe('sym_2');
    });
  });

  it('shows 該当なし when search matches nothing', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('symbol-search')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('watchlist-select'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('symbol-search'), { target: { value: 'zzzz-no-match' } });
    await waitFor(() => {
      expect(screen.getByText('該当なし')).toBeInTheDocument();
    });
  });

  it('uses watchlist symbols when a list is selected', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('watchlist-select')).toBeInTheDocument());
    // 初期は wl_1。検索クリアで Tech 内の AAPL のみ
    fireEvent.change(screen.getByTestId('symbol-search'), { target: { value: '' } });
    const select = screen.getByTestId('symbol-select') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['sym_1']);
  });

  it('shows chart fetch error', async () => {
    (fetchSymbolPrices as jest.Mock).mockRejectedValue(
      new ApiClientError(422, 'INSUFFICIENT_PRICE_DATA', 'not enough'),
    );
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByText('not enough')).toBeInTheDocument());
  });

  it('shows generic chart error', async () => {
    (fetchSymbolPrices as jest.Mock).mockRejectedValue(new Error('network'));
    render(<ChartsPage />);
    await waitFor(() =>
      expect(screen.getByText('チャートの取得に失敗しました')).toBeInTheDocument(),
    );
  });

  it('handles empty symbols list', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    (fetchWatchlists as jest.Mock).mockResolvedValue([]);
    render(<ChartsPage />);
    await waitFor(() => expect(screen.queryByText('読み込み中…')).not.toBeInTheDocument());
    expect(screen.queryByTestId('analysis-chart-stub')).not.toBeInTheDocument();
  });
});
