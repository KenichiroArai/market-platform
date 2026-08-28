/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import ChartsPage from '../../../../app/(app)/charts/page';
import {
  ApiClientError,
  createIndicatorSet,
  fetchIndicatorSets,
  fetchSymbolIndicators,
  fetchSymbolPrices,
  fetchSymbolTrendScore,
  fetchSymbols,
  fetchWatchlists,
} from '../../../../lib/api-client';
import { defaultChartFromDate, defaultChartToDate } from '../../../../lib/chart-date-range';

jest.mock('../../../../lib/api-client', () => ({
  fetchSymbols: jest.fn(),
  fetchWatchlists: jest.fn(),
  fetchSymbolPrices: jest.fn(),
  fetchSymbolIndicators: jest.fn(),
  fetchSymbolTrendScore: jest.fn(),
  fetchIndicatorSets: jest.fn(),
  createIndicatorSet: jest.fn(),
  deleteIndicatorSet: jest.fn(),
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

jest.mock('../../../../components/analysis-chart', () => ({
  AnalysisChart: ({
    loading,
    prices,
    onBarClick,
  }: {
    loading?: boolean;
    prices?: { date: string }[];
    onBarClick?: (date: string) => void;
  }) => (
    <div data-testid="analysis-chart-stub">
      {loading ? 'loading' : `ready:${prices?.length ?? 0}`}
      <button
        type="button"
        data-testid="stub-bar-click"
        onClick={() => onBarClick?.('2026-01-02')}
      >
        click-bar
      </button>
    </div>
  ),
  computeAnalysisChartHeight: () => 400,
  resolveScoredPoint: (
    points: { date: string; score: number | null }[],
    baseDate: string | null | undefined,
  ) => {
    if (baseDate) {
      const found = points.find((point) => point.date === baseDate);
      if (found) {
        return found;
      }
    }
    for (let i = points.length - 1; i >= 0; i -= 1) {
      const point = points[i];
      if (point && point.score !== null) {
        return point;
      }
    }
    return null;
  },
}));

jest.mock('../../../../components/popout-window', () => {
  const actual = jest.requireActual('../../../../components/popout-window') as Record<string, unknown>;
  return {
    ...actual,
    primePopoutWindow: jest.fn(),
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
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
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
    (fetchSymbolTrendScore as jest.Mock).mockResolvedValue({
      symbolId: 'sym_1',
      points: [
        {
          date: '2026-01-02',
          score: 12,
          groups: {
            trend: 8,
            momentum: 2,
            oscillator: 0,
            volatility: 1,
            volume: 1,
            cycle: 0,
          },
          indicators: { sma25: 20 },
        },
      ],
    });
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([
      {
        id: 'set_1',
        userId: 'u_1',
        name: 'スイング',
        indicatorIds: ['rsi'],
        groupWeights: null,
        buyThreshold: null,
        sellThreshold: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    (createIndicatorSet as jest.Mock).mockResolvedValue({
      id: 'set_2',
      userId: 'u_1',
      name: '新規',
      indicatorIds: ['sma25'],
      indicatorParams: {},
      groupWeights: null,
      buyThreshold: null,
      sellThreshold: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('loads symbols and chart data', async () => {
    render(<ChartsPage />);
    expect(screen.getByText('読み込み中…')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('analysis-chart-stub')).toHaveTextContent('ready'),
    );
    const expectedFrom = defaultChartFromDate();
    const expectedTo = defaultChartToDate();
    expect(fetchSymbolPrices).toHaveBeenCalledWith('sym_1', {
      from: expectedFrom,
      to: expectedTo,
      interval: '1d',
    });
    expect(fetchSymbolIndicators).toHaveBeenCalledWith(
      'sym_1',
      expect.objectContaining({
        indicators: 'sma25,sma75,sma200,macd,ichimoku,rsi,bb,obv',
        interval: '1d',
      }),
    );
    expect(fetchSymbolTrendScore).toHaveBeenCalledWith(
      'sym_1',
      expect.objectContaining({
        from: expectedFrom,
        to: expectedTo,
        interval: '1d',
        indicatorParams: {},
      }),
    );
  });

  it('applies symbolId watchlistId from and to from search params', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams({
        symbolId: 'sym_2',
        from: '2025-01-01',
        to: '2025-06-30',
      }),
    );
    render(<ChartsPage />);
    await waitFor(() =>
      expect(fetchSymbolPrices).toHaveBeenCalledWith('sym_2', {
        from: '2025-01-01',
        to: '2025-06-30',
        interval: '1d',
      }),
    );
    expect(screen.getByTestId('symbol-select')).toHaveValue('sym_2');
    // 銘柄クエリのみのときは WL を「すべて」にして銘柄を選択肢に残す
    expect(screen.getByTestId('watchlist-select')).toHaveValue('');
  });

  it('applies watchlistId from search params with symbol in that list', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams({
        symbolId: 'sym_1',
        watchlistId: 'wl_1',
        from: '2025-01-01',
        to: '2025-06-30',
      }),
    );
    render(<ChartsPage />);
    await waitFor(() =>
      expect(fetchSymbolPrices).toHaveBeenCalledWith('sym_1', {
        from: '2025-01-01',
        to: '2025-06-30',
        interval: '1d',
      }),
    );
    expect(screen.getByTestId('symbol-select')).toHaveValue('sym_1');
    expect(screen.getByTestId('watchlist-select')).toHaveValue('wl_1');
  });

  it('ignores invalid query ids and falls back to first rows', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams({
        symbolId: 'missing',
        watchlistId: 'missing',
      }),
    );
    render(<ChartsPage />);
    await waitFor(() =>
      expect(fetchSymbolPrices).toHaveBeenCalledWith(
        'sym_1',
        expect.objectContaining({ interval: '1d' }),
      ),
    );
    expect(screen.getByTestId('symbol-select')).toHaveValue('sym_1');
    expect(screen.getByTestId('watchlist-select')).toHaveValue('wl_1');
  });

  it('shows link to add symbols when none are registered', async () => {
    (fetchSymbols as jest.Mock).mockResolvedValue([]);
    (fetchWatchlists as jest.Mock).mockResolvedValue([]);
    render(<ChartsPage />);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: '銘柄を追加' })).toHaveAttribute('href', '/symbols');
    });
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

    fireEvent.click(screen.getByTestId('open-indicator'));
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

  it('requests weekly indicators and trend score with interval 1w', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByLabelText('週足')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('週足'));
    await waitFor(() => {
      expect(fetchSymbolIndicators).toHaveBeenCalledWith(
        'sym_1',
        expect.objectContaining({ interval: '1w' }),
      );
      expect(fetchSymbolTrendScore).toHaveBeenCalledWith(
        'sym_1',
        expect.objectContaining({ interval: '1w' }),
      );
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

  it('keeps price data when trend score fails', async () => {
    (fetchSymbolTrendScore as jest.Mock).mockRejectedValue(
      new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected trend score response'),
    );
    render(<ChartsPage />);
    await waitFor(() =>
      expect(screen.getByText('Unexpected trend score response')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('analysis-chart-stub')).toHaveTextContent('ready:1');
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
    await waitFor(() => expect(screen.getByTestId('open-indicator')).toBeInTheDocument());
    expect(screen.queryByTestId('indicator-catalog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-indicator'));
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();
    expect(screen.getByTestId('indicator-catalog')).toBeInTheDocument();
    expect(screen.getByTestId('open-indicator')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('modeless-close'));
    expect(screen.queryByTestId('modeless-window')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-indicator'));
    fireEvent.click(screen.getByTestId('open-indicator'));
    expect(screen.queryByTestId('modeless-window')).not.toBeInTheDocument();
  });

  it('does not change open window when preferred radio changes until button is pressed again', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-indicator'));
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();

    const preferred = screen.getByTestId('display-preferred-mode');
    const popoutRadio = preferred.querySelector(
      'input[type="radio"][value="popout"]',
    ) as HTMLInputElement;
    fireEvent.click(popoutRadio);
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();
    expect(screen.queryByTestId('popout-stub')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-indicator'));
    expect(screen.queryByTestId('modeless-window')).not.toBeInTheDocument();
    expect(screen.getByTestId('popout-stub')).toHaveAttribute('data-title', '指標設定');
    expect(screen.getByTestId('indicator-catalog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('popout-stub-close'));
    expect(screen.queryByTestId('popout-stub')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-indicator'));
    expect(screen.getByTestId('popout-stub')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-indicator'));
    expect(screen.queryByTestId('popout-stub')).not.toBeInTheDocument();
  });

  it('switches display mode from inside the open window', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-indicator'));
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();

    const inWindow = screen.getByTestId('indicator-in-window-mode');
    const popoutRadio = inWindow.querySelector(
      'input[type="radio"][value="popout"]',
    ) as HTMLInputElement;
    fireEvent.click(popoutRadio);
    expect(screen.queryByTestId('modeless-window')).not.toBeInTheDocument();
    expect(screen.getByTestId('popout-stub')).toHaveAttribute('data-title', '指標設定');

    const popoutSwitch = screen.getByTestId('indicator-in-window-mode');
    fireEvent.click(
      popoutSwitch.querySelector('input[type="radio"][value="modeless"]') as HTMLInputElement,
    );
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();
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

  it('opens the indicator set picker independently and applies a set', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator-set')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-indicator'));
    expect(screen.getByTestId('indicator-catalog')).toBeInTheDocument();
    expect(screen.getByTestId('indicator-set-save')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-indicator-set'));
    await waitFor(() => expect(screen.getByTestId('indicator-set-picker')).toBeInTheDocument());
    expect(screen.getByTestId('indicator-catalog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('indicator-set-apply-set_1'));
    expect(screen.getByTestId('enabled-indicator-count')).toHaveTextContent('選択中 1 件');
    expect(screen.getAllByTestId('overlay-rsi')[0]).toBeChecked();

    const closeButtons = screen.getAllByTestId('modeless-close');
    fireEvent.click(closeButtons[closeButtons.length - 1]!);
    expect(screen.queryByTestId('indicator-set-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('indicator-catalog')).toBeInTheDocument();
  });

  it('opens the indicator set picker in a separate window via preferred mode', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator-set')).toBeInTheDocument());

    const preferred = screen.getByTestId('display-preferred-mode');
    const popoutRadio = preferred.querySelector(
      'input[type="radio"][value="popout"]',
    ) as HTMLInputElement;
    fireEvent.click(popoutRadio);
    fireEvent.click(screen.getByTestId('open-indicator-set'));
    await waitFor(() =>
      expect(screen.getByTestId('popout-stub')).toHaveAttribute('data-title', '指標セット呼び出し'),
    );
    expect(screen.getByTestId('indicator-set-picker')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('popout-stub-close'));
    expect(screen.queryByTestId('indicator-set-picker')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-indicator-set'));
    expect(screen.getByTestId('popout-stub')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-indicator-set'));
    expect(screen.queryByTestId('popout-stub')).not.toBeInTheDocument();
  });

  it('saves the current indicator selection from the settings window', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('open-indicator'));
    fireEvent.change(screen.getByTestId('indicator-set-name'), { target: { value: '新規' } });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-success')).toHaveTextContent('保存しました'),
    );
    expect(createIndicatorSet).toHaveBeenCalled();
  });

  it('opens score breakdown and reflects chart bar clicks as base date', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-score-breakdown')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('stub-bar-click'));
    fireEvent.click(screen.getByTestId('open-score-breakdown'));
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();
    expect(screen.getByTestId('trend-score-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('trend-score-breakdown-summary')).toHaveTextContent(
      '基準日 2026-01-02',
    );
    expect(screen.getByTestId('open-score-breakdown')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('modeless-close'));
    expect(screen.queryByTestId('trend-score-breakdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('open-score-breakdown'));
    fireEvent.click(screen.getByTestId('open-score-breakdown'));
    expect(screen.queryByTestId('trend-score-breakdown')).not.toBeInTheDocument();
  });

  it('opens score breakdown in a separate window and accepts base date input', async () => {
    (fetchSymbolTrendScore as jest.Mock).mockResolvedValue({
      symbolId: 'sym_1',
      points: [
        {
          date: '2026-01-02',
          score: 12,
          groups: {
            trend: 8,
            momentum: 2,
            oscillator: 0,
            volatility: 1,
            volume: 1,
            cycle: 0,
          },
          indicators: { sma25: 20 },
        },
        {
          date: '2026-01-09',
          score: -4,
          groups: {
            trend: -2,
            momentum: -1,
            oscillator: 0,
            volatility: -1,
            volume: 0,
            cycle: 0,
          },
          indicators: { sma25: -10 },
        },
      ],
    });

    render(<ChartsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('base-date-input')).toHaveValue('2026-01-09'),
    );

    fireEvent.change(screen.getByTestId('base-date-input'), { target: { value: '2026-01-07' } });
    await waitFor(() =>
      expect(screen.getByTestId('base-date-input')).toHaveValue('2026-01-02'),
    );

    fireEvent.change(screen.getByTestId('base-date-input'), { target: { value: '' } });
    await waitFor(() =>
      expect(screen.getByTestId('base-date-input')).toHaveValue('2026-01-09'),
    );

    const preferred = screen.getByTestId('display-preferred-mode');
    const popoutRadio = preferred.querySelector(
      'input[type="radio"][value="popout"]',
    ) as HTMLInputElement;
    fireEvent.click(popoutRadio);
    fireEvent.click(screen.getByTestId('open-score-breakdown'));
    expect(screen.getByTestId('popout-stub')).toHaveAttribute('data-title', 'スコア内訳');
    expect(screen.getByTestId('trend-score-breakdown-summary')).toHaveTextContent(
      '基準日 2026-01-09',
    );

    fireEvent.click(screen.getByTestId('popout-stub-close'));
    expect(screen.queryByTestId('trend-score-breakdown')).not.toBeInTheDocument();
  });

  it('switches recall and score windows from inside each window', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator-set')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-indicator-set'));
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();
    const recallInWindow = screen.getByTestId('recall-in-window-mode');
    fireEvent.click(
      recallInWindow.querySelector('input[type="radio"][value="popout"]') as HTMLInputElement,
    );
    expect(screen.getByTestId('popout-stub')).toHaveAttribute('data-title', '指標セット呼び出し');
    const recallPopoutSwitch = screen.getByTestId('recall-in-window-mode');
    fireEvent.click(
      recallPopoutSwitch.querySelector(
        'input[type="radio"][value="modeless"]',
      ) as HTMLInputElement,
    );
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modeless-close'));

    fireEvent.click(screen.getByTestId('open-score-breakdown'));
    expect(screen.getByTestId('trend-score-breakdown')).toBeInTheDocument();
    const scoreInWindow = screen.getByTestId('score-in-window-mode');
    fireEvent.click(
      scoreInWindow.querySelector('input[type="radio"][value="popout"]') as HTMLInputElement,
    );
    expect(screen.getByTestId('popout-stub')).toHaveAttribute('data-title', 'スコア内訳');
    const scorePopoutSwitch = screen.getByTestId('score-in-window-mode');
    fireEvent.click(
      scorePopoutSwitch.querySelector(
        'input[type="radio"][value="modeless"]',
      ) as HTMLInputElement,
    );
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();
  });

  it('keeps other windows unchanged when one window switches display mode inside itself', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('open-indicator'));
    fireEvent.click(screen.getByTestId('open-score-breakdown'));
    expect(screen.getAllByTestId('modeless-window')).toHaveLength(2);

    const indicatorSwitch = screen.getAllByTestId('indicator-in-window-mode')[0]!;
    fireEvent.click(
      indicatorSwitch.querySelector('input[type="radio"][value="popout"]') as HTMLInputElement,
    );
    expect(screen.getByTestId('popout-stub')).toHaveAttribute('data-title', '指標設定');
    expect(screen.getByTestId('trend-score-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('modeless-window')).toBeInTheDocument();
    expect(screen.getByTestId('display-preferred-mode').querySelector('input[value="modeless"]')).toBeChecked();
  });

  it('keeps typed base date when there are no score points to snap to', async () => {
    (fetchSymbolTrendScore as jest.Mock).mockResolvedValue({
      symbolId: 'sym_1',
      points: [],
    });
    render(<ChartsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('analysis-chart-stub')).toHaveTextContent('ready'),
    );
    fireEvent.change(screen.getByTestId('base-date-input'), { target: { value: '2026-03-15' } });
    expect(screen.getByTestId('base-date-input')).toHaveValue('2026-03-15');
  });

  it('duplicates a set into the indicator settings window', async () => {
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator-set')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('open-indicator-set'));
    await waitFor(() => expect(screen.getByTestId('indicator-set-duplicate-set_1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('indicator-set-duplicate-set_1'));
    await waitFor(() => expect(screen.getByTestId('indicator-catalog')).toBeInTheDocument());
    expect(screen.getByTestId('indicator-set-name')).toHaveValue('スイング');
    expect(screen.getAllByTestId('overlay-rsi')[0]).toBeChecked();
  });

  it('tolerates indicator set list fetch failures', async () => {
    (fetchIndicatorSets as jest.Mock).mockRejectedValue(new Error('network'));
    render(<ChartsPage />);
    await waitFor(() =>
      expect(screen.getByTestId('analysis-chart-stub')).toHaveTextContent('ready'),
    );
  });

  it('refreshes indicator sets after save even when refresh fails', async () => {
    (fetchIndicatorSets as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'set_1',
          userId: 'u_1',
          name: 'スイング',
          indicatorIds: ['rsi'],
          indicatorParams: {},
          groupWeights: null,
          buyThreshold: null,
          sellThreshold: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ])
      .mockRejectedValueOnce(new Error('refresh failed'));
    render(<ChartsPage />);
    await waitFor(() => expect(screen.getByTestId('open-indicator')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('open-indicator'));
    fireEvent.change(screen.getByTestId('indicator-set-name'), { target: { value: '新規' } });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-success')).toHaveTextContent('保存しました'),
    );
    expect(fetchIndicatorSets).toHaveBeenCalledTimes(2);
  });
});
