/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
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
  AnalysisChart: ({
    loading,
    prices,
  }: {
    loading?: boolean;
    prices?: { date: string }[];
  }) => (
    <div data-testid="analysis-chart-stub">
      {loading ? 'loading' : `ready:${prices?.length ?? 0}`}
    </div>
  ),
  computeAnalysisChartHeight: () => 400,
}));

jest.mock('../../../components/popout-window', () => {
  const actual = jest.requireActual('../../../components/popout-window') as Record<string, unknown>;
  return {
    ...actual,
    PopoutWindow: ({
      children,
      onClose,
      title,
    }: {
      children: ReactNode | ((api: { win: Window }) => ReactNode);
      onClose: () => void;
      title: string;
    }) => (
      <div data-testid="popout-stub" data-title={title}>
        {typeof children === 'function' ? children({ win: window }) : children}
        <button type="button" onClick={onClose} data-testid="popout-stub-close">
          close
        </button>
      </div>
    ),
  };
});

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
      points: [{ date: '2026-01-02', values: { sma25: 1.2 } }],
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
      expect.objectContaining({
        indicators: 'sma25,sma75,sma200,macd,ichimoku,rsi,bb,obv',
        interval: '1d',
      }),
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

    fireEvent.click(screen.getByTestId('open-indicator-modeless'));
    fireEvent.click(screen.getByTestId('overlay-sma25'));
    fireEvent.click(screen.getByTestId('clear-indicators'));
    await waitFor(() => {
      const lastPricesCall = (fetchSymbolPrices as jest.Mock).mock.calls.at(-1);
      expect(lastPricesCall?.[0]).toBe('sym_2');
    });
    await waitFor(() => {
      const indicatorCalls = (fetchSymbolIndicators as jest.Mock).mock.calls;
      const last = indicatorCalls.at(-1);
      expect(last === undefined || last[0] === 'sym_2').toBe(true);
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

  it('keeps price data when indicators fail', async () => {
    (fetchSymbolIndicators as jest.Mock).mockRejectedValue(
      new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected indicators response'),
    );
    render(<ChartsPage />);
    await waitFor(() =>
      expect(screen.getByText('Unexpected indicators response')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('analysis-chart-stub')).toHaveTextContent('ready:1');
  });

  it('joins price and indicator errors', async () => {
    (fetchSymbolPrices as jest.Mock).mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', 'price failed'),
    );
    (fetchSymbolIndicators as jest.Mock).mockRejectedValue(
      new ApiClientError(500, 'INVALID_RESPONSE', 'indicator failed'),
    );
    render(<ChartsPage />);
    await waitFor(() =>
      expect(screen.getByText('price failed / indicator failed')).toBeInTheDocument(),
    );
  });

  it('handles empty symbols list', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    (fetchWatchlists as jest.Mock).mockResolvedValue([]);
    render(<ChartsPage />);
    await waitFor(() => expect(screen.queryByText('読み込み中…')).not.toBeInTheDocument());
    expect(screen.queryByTestId('analysis-chart-stub')).not.toBeInTheDocument();
    expect(screen.queryByTestId('indicator-catalog')).not.toBeInTheDocument();
  });

  it('opens indicator settings in a modeless window and closes it', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator-modeless')).toBeInTheDocument());
    expect(screen.queryByTestId('indicator-catalog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-indicator-modeless'));
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();
    expect(screen.getByTestId('indicator-catalog')).toBeInTheDocument();
    expect(screen.getByTestId('open-indicator-modeless')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('modeless-close'));
    expect(screen.queryByTestId('modeless-window')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-indicator-modeless'));
    fireEvent.click(screen.getByTestId('open-indicator-modeless'));
    expect(screen.queryByTestId('modeless-window')).not.toBeInTheDocument();
  });

  it('switches from modeless to a separate window', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator-popout')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-indicator-modeless'));
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-indicator-popout'));
    expect(screen.queryByTestId('modeless-window')).not.toBeInTheDocument();
    expect(screen.getByTestId('popout-stub')).toHaveAttribute('data-title', '指標設定');
    expect(screen.getByTestId('indicator-catalog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('popout-stub-close'));
    expect(screen.queryByTestId('popout-stub')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-indicator-popout'));
    expect(screen.getByTestId('popout-stub')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-indicator-popout'));
    expect(screen.queryByTestId('popout-stub')).not.toBeInTheDocument();
  });

  it('enlarges the chart into a fullscreen window', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('enlarge-chart')).toBeInTheDocument());
    expect(screen.getAllByTestId('analysis-chart-stub')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('enlarge-chart'));
    expect(screen.getByText('拡大ウィンドウを閉じる')).toBeInTheDocument();
    expect(screen.getByTestId('popout-stub')).toHaveAttribute('data-title', 'チャート分析（拡大）');
    expect(screen.getAllByTestId('analysis-chart-stub')).toHaveLength(2);

    fireEvent.click(screen.getByTestId('popout-stub-close'));
    expect(screen.getByText('拡大')).toBeInTheDocument();
    expect(screen.queryByTestId('popout-stub')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('enlarge-chart'));
    fireEvent.click(screen.getByTestId('enlarge-chart'));
    expect(screen.queryByTestId('popout-stub')).not.toBeInTheDocument();
  });
});
