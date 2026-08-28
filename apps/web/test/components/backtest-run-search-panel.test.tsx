/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  buildSearchQueryFromForm,
  BacktestRunSearchPanel,
  formatRunCreatedAt,
  formatSearchResultCount,
} from '../../components/backtest-run-search-panel';
import {
  ApiClientError,
  deleteBacktestRun,
  deleteBacktestRuns,
  fetchBacktestRuns,
} from '../../lib/api-client';

jest.mock('../../components/modeless-window', () => ({
  ModelessWindow: ({
    title,
    children,
    onClose,
  }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <div data-testid="modeless-window">
      <h2>{title}</h2>
      <button type="button" onClick={onClose}>
        close
      </button>
      {children}
    </div>
  ),
}));

jest.mock('../../lib/api-client', () => ({
  fetchBacktestRuns: jest.fn(),
  deleteBacktestRun: jest.fn(),
  deleteBacktestRuns: jest.fn(),
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

describe('BacktestRunSearchPanel helpers', () => {
  it('builds search query and formats createdAt', () => {
    expect(
      buildSearchQueryFromForm({
        symbolId: 'sym_1',
        strategyType: 'smaCross',
        indicatorSetId: 'set_1',
        fromDate: '2026-01-01',
        toDate: '2026-06-30',
        createdFrom: '2026-02-01',
        createdTo: '2026-03-01',
        includeDeleted: true,
      }),
    ).toEqual({
      symbolId: 'sym_1',
      strategyType: 'smaCross',
      indicatorSetId: 'set_1',
      fromDate: '2026-01-01',
      toDate: '2026-06-30',
      createdFrom: '2026-02-01',
      createdTo: '2026-03-01',
      isActive: 'all',
    });
    expect(formatRunCreatedAt('2026-01-01T12:34:56.000Z')).toBe('2026-01-01 12:34');
    expect(formatSearchResultCount(3)).toBe('検索結果: 3 件');
    expect(formatSearchResultCount(0)).toBe('検索結果: 0 件');
  });
});

describe('BacktestRunSearchPanel', () => {
  const symbols = [
    {
      id: 'sym_1',
      ticker: 'AAPL',
      market: 'US' as const,
      name: 'Apple',
      currency: 'USD',
      exchange: 'NASDAQ',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const indicatorSets = [
    {
      id: 'set_1',
      userId: 'u_1',
      name: 'SMA',
      indicatorIds: ['sma25', 'sma75'] as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const activeRun = {
    id: 'run_1',
    symbolId: 'sym_1',
    indicatorSetId: 'set_1',
    strategyType: 'smaCross' as const,
    fromDate: '2026-01-01',
    toDate: '2026-06-30',
    summary: {
      finalEquity: 110000,
      totalReturnRate: 0.1,
      maxDrawdownRate: 0.05,
      totalTrades: 2,
      winRate: 0.5,
      sharpeRatio: 1,
      profitFactor: 1.2,
      buyHoldReturnRate: 0.05,
      buyHoldFinalEquity: 105000,
    },
    isActive: true,
    createdAt: '2026-01-01T10:00:00.000Z',
  };
  const deletedRun = { ...activeRun, id: 'run_2', isActive: false };

  let confirmMock: jest.SpyInstance<boolean, [string?]>;

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([activeRun]);
    (deleteBacktestRun as jest.Mock).mockResolvedValue(undefined);
    (deleteBacktestRuns as jest.Mock).mockResolvedValue({ deletedCount: 1 });
    confirmMock = jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    confirmMock.mockRestore();
  });

  it('searches, selects, and deletes runs', async () => {
    const onClose = jest.fn();
    const onSelectRun = jest.fn();
    const onRunsChanged = jest.fn();

    render(
      <BacktestRunSearchPanel
        symbols={symbols}
        indicatorSets={indicatorSets}
        onClose={onClose}
        onSelectRun={onSelectRun}
        onRunsChanged={onRunsChanged}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('backtest-search-row-run_1')).toBeInTheDocument());
    expect(screen.getByTestId('backtest-search-result-count')).toHaveTextContent('検索結果: 1 件');
    expect(screen.getByRole('columnheader', { name: '開始' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '終了' })).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('backtest-search-symbol'), {
      target: { value: 'sym_1' },
    });
    fireEvent.change(screen.getByTestId('backtest-search-strategy'), {
      target: { value: 'macdCross' },
    });
    fireEvent.change(screen.getByTestId('backtest-search-indicator-set'), {
      target: { value: 'set_1' },
    });
    fireEvent.change(screen.getByTestId('backtest-search-from-date'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByTestId('backtest-search-to-date'), {
      target: { value: '2026-06-30' },
    });
    fireEvent.change(screen.getByTestId('backtest-search-created-from'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(screen.getByTestId('backtest-search-created-to'), {
      target: { value: '2026-06-30' },
    });
    fireEvent.click(screen.getByTestId('backtest-search-include-deleted'));
    fireEvent.click(screen.getByRole('button', { name: '検索' }));
    await waitFor(() =>
      expect(fetchBacktestRuns).toHaveBeenLastCalledWith(
        expect.objectContaining({
          symbolId: 'sym_1',
          strategyType: 'macdCross',
          indicatorSetId: 'set_1',
          isActive: 'all',
        }),
      ),
    );

    fireEvent.click(screen.getByTestId('backtest-search-select-run_1'));
    expect(onSelectRun).toHaveBeenCalledWith('run_1');
    expect(onClose).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('backtest-search-delete-run_1'));
    await waitFor(() => expect(deleteBacktestRun).toHaveBeenCalledWith('run_1'));
    expect(onRunsChanged).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('backtest-delete-search-results'));
    await waitFor(() => expect(deleteBacktestRuns).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('backtest-delete-all-active'));
    await waitFor(() =>
      expect(deleteBacktestRuns).toHaveBeenLastCalledWith({ isActive: true }),
    );
  });

  it('handles cancelled confirms, inactive rows, and errors', async () => {
    confirmMock.mockReturnValueOnce(false);
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([activeRun, deletedRun]);

    render(
      <BacktestRunSearchPanel
        symbols={symbols}
        indicatorSets={indicatorSets}
        onClose={jest.fn()}
        onSelectRun={jest.fn()}
        onRunsChanged={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('backtest-search-row-run_2')).toBeInTheDocument());
    expect(screen.getByText('削除済み')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('backtest-search-delete-run_1'));
    expect(deleteBacktestRun).not.toHaveBeenCalled();

    confirmMock.mockReturnValueOnce(false);
    fireEvent.click(screen.getByTestId('backtest-delete-search-results'));
    expect(deleteBacktestRuns).not.toHaveBeenCalled();

    confirmMock.mockReturnValueOnce(false);
    fireEvent.click(screen.getByTestId('backtest-delete-all-active'));
    expect(deleteBacktestRuns).not.toHaveBeenCalled();
  });

  it('shows errors from fetch and delete APIs', async () => {
    (fetchBacktestRuns as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', 'fetch failed'));
    render(
      <BacktestRunSearchPanel
        symbols={symbols}
        indicatorSets={indicatorSets}
        onClose={jest.fn()}
        onSelectRun={jest.fn()}
        onRunsChanged={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('fetch failed')).toBeInTheDocument());

    (fetchBacktestRuns as jest.Mock).mockResolvedValue([activeRun]);
    (deleteBacktestRun as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', 'single failed'));
    fireEvent.click(screen.getByRole('button', { name: '検索' }));
    await waitFor(() => expect(screen.getByTestId('backtest-search-delete-run_1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('backtest-search-delete-run_1'));
    await waitFor(() => expect(screen.getByText('single failed')).toBeInTheDocument());

    (deleteBacktestRun as jest.Mock).mockRejectedValue(new Error('delete failed'));
    fireEvent.click(screen.getByTestId('backtest-search-delete-run_1'));
    await waitFor(() => expect(screen.getByText('削除に失敗しました')).toBeInTheDocument());

    (deleteBacktestRuns as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', 'bulk failed'));
    fireEvent.click(screen.getByTestId('backtest-delete-search-results'));
    await waitFor(() => expect(screen.getByText('bulk failed')).toBeInTheDocument());

    (deleteBacktestRuns as jest.Mock).mockRejectedValue(new Error('bulk generic failed'));
    fireEvent.click(screen.getByTestId('backtest-delete-search-results'));
    await waitFor(() => expect(screen.getByText('一括削除に失敗しました')).toBeInTheDocument());

    (deleteBacktestRuns as jest.Mock).mockRejectedValue(new ApiClientError(500, 'X', 'all failed'));
    fireEvent.click(screen.getByTestId('backtest-delete-all-active'));
    await waitFor(() => expect(screen.getByText('all failed')).toBeInTheDocument());

    (deleteBacktestRuns as jest.Mock).mockRejectedValue(new Error('all generic failed'));
    fireEvent.click(screen.getByTestId('backtest-delete-all-active'));
    await waitFor(() => expect(screen.getByText('一括削除に失敗しました')).toBeInTheDocument());
  });

  it('skips bulk delete when no active results', async () => {
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([deletedRun]);
    render(
      <BacktestRunSearchPanel
        symbols={symbols}
        indicatorSets={indicatorSets}
        onClose={jest.fn()}
        onSelectRun={jest.fn()}
        onRunsChanged={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('backtest-delete-search-results')).toBeDisabled());
  });

  it('uses symbolId when ticker is unknown on delete confirm', async () => {
    const unknownRun = { ...activeRun, id: 'run_x', symbolId: 'unknown_sym' };
    (fetchBacktestRuns as jest.Mock).mockResolvedValue([unknownRun]);
    render(
      <BacktestRunSearchPanel
        symbols={symbols}
        indicatorSets={indicatorSets}
        onClose={jest.fn()}
        onSelectRun={jest.fn()}
        onRunsChanged={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('backtest-search-delete-run_x')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('backtest-search-delete-run_x'));
    await waitFor(() => expect(deleteBacktestRun).toHaveBeenCalledWith('run_x'));
  });

  it('shows generic fetch error message', async () => {
    (fetchBacktestRuns as jest.Mock).mockRejectedValue(new Error('network'));
    render(
      <BacktestRunSearchPanel
        symbols={symbols}
        indicatorSets={indicatorSets}
        onClose={jest.fn()}
        onSelectRun={jest.fn()}
        onRunsChanged={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText('検索に失敗しました')).toBeInTheDocument());
  });
});
