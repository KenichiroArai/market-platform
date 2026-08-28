/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IndicatorSetPicker, indicatorSetSummary } from '../../components/indicator-set-picker';
import { ApiClientError, deleteIndicatorSet, fetchIndicatorSets } from '../../lib/api-client';

jest.mock('../../lib/api-client', () => ({
  fetchIndicatorSets: jest.fn(),
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

const swing = {
  id: 'set_1',
  userId: 'user_1',
  name: 'スイング',
  indicatorIds: ['sma25', 'rsi'] as const,
  indicatorParams: {},
  groupWeights: null,
  buyThreshold: null,
  sellThreshold: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const day = {
  id: 'set_2',
  userId: 'user_1',
  name: 'デイトレ',
  indicatorIds: ['macd', 'volume'] as const,
  indicatorParams: {},
  groupWeights: null,
  buyThreshold: null,
  sellThreshold: null,
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('indicatorSetSummary', () => {
  it('joins names and handles empty sets', () => {
    expect(indicatorSetSummary([])).toBe('指標なし');
    expect(indicatorSetSummary(['sma25', 'rsi'])).toContain('RSI');
  });
});

describe('IndicatorSetPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads sets and applies one', async () => {
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([swing, day]);
    const onApply = jest.fn();
    render(<IndicatorSetPicker onApply={onApply} onDuplicate={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('indicator-set-row-set_1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('indicator-set-apply-set_1'));
    expect(onApply).toHaveBeenCalledWith(swing);
  });

  it('calls onDuplicate when duplicate is clicked', async () => {
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([swing]);
    const onDuplicate = jest.fn();
    render(<IndicatorSetPicker onApply={jest.fn()} onDuplicate={onDuplicate} />);
    await waitFor(() => expect(screen.getByTestId('indicator-set-duplicate-set_1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('indicator-set-duplicate-set_1'));
    expect(onDuplicate).toHaveBeenCalledWith(swing);
  });

  it('filters by name and required indicators', async () => {
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([swing, day]);
    render(<IndicatorSetPicker onApply={jest.fn()} onDuplicate={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('スイング')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('indicator-set-search-name'), { target: { value: 'デイ' } });
    expect(screen.queryByText('スイング')).not.toBeInTheDocument();
    expect(screen.getByText('デイトレ')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('indicator-set-search-name'), { target: { value: '' } });
    fireEvent.click(screen.getAllByTestId('set-filter-rsi')[0]!);
    expect(screen.getByText('スイング')).toBeInTheDocument();
    expect(screen.queryByText('デイトレ')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-filter-elliott')).not.toBeInTheDocument();
  });

  it('shows loading then the list', async () => {
    let resolveList: (value: unknown) => void = () => undefined;
    (fetchIndicatorSets as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    render(<IndicatorSetPicker onApply={jest.fn()} onDuplicate={jest.fn()} />);
    expect(screen.getByTestId('indicator-set-picker-loading')).toBeInTheDocument();
    resolveList([swing]);
    await waitFor(() => expect(screen.getByTestId('indicator-set-row-set_1')).toBeInTheDocument());
  });

  it('shows empty state', async () => {
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([]);
    render(<IndicatorSetPicker onApply={jest.fn()} onDuplicate={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByText('該当するセットがありません')).toBeInTheDocument(),
    );
  });

  it('shows ApiClientError on load failure', async () => {
    (fetchIndicatorSets as jest.Mock).mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', '読み込み失敗'),
    );
    render(<IndicatorSetPicker onApply={jest.fn()} onDuplicate={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-picker-error')).toHaveTextContent('読み込み失敗'),
    );
  });

  it('shows a fallback on unexpected load failure', async () => {
    (fetchIndicatorSets as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<IndicatorSetPicker onApply={jest.fn()} onDuplicate={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-picker-error')).toHaveTextContent(
        '読み込みに失敗しました',
      ),
    );
  });

  it('deletes a set', async () => {
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([swing, day]);
    (deleteIndicatorSet as jest.Mock).mockResolvedValue(undefined);
    render(<IndicatorSetPicker onApply={jest.fn()} onDuplicate={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('indicator-set-delete-set_1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('indicator-set-delete-set_1'));
    await waitFor(() => expect(screen.queryByTestId('indicator-set-row-set_1')).not.toBeInTheDocument());
    expect(deleteIndicatorSet).toHaveBeenCalledWith('set_1');
    expect(screen.getByTestId('indicator-set-row-set_2')).toBeInTheDocument();
  });

  it('disables delete while the request is in flight', async () => {
    let resolveDelete: (value: unknown) => void = () => undefined;
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([swing]);
    (deleteIndicatorSet as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = resolve;
      }),
    );
    render(<IndicatorSetPicker onApply={jest.fn()} onDuplicate={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('indicator-set-delete-set_1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('indicator-set-delete-set_1'));
    expect(screen.getByTestId('indicator-set-delete-set_1')).toBeDisabled();
    resolveDelete(undefined);
    await waitFor(() => expect(screen.queryByTestId('indicator-set-row-set_1')).not.toBeInTheDocument());
  });

  it('shows ApiClientError when delete fails', async () => {
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([swing]);
    (deleteIndicatorSet as jest.Mock).mockRejectedValue(
      new ApiClientError(404, 'INDICATOR_SET_NOT_FOUND', 'not found'),
    );
    render(<IndicatorSetPicker onApply={jest.fn()} onDuplicate={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('indicator-set-delete-set_1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('indicator-set-delete-set_1'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-picker-error')).toHaveTextContent('not found'),
    );
  });

  it('shows a fallback when delete fails unexpectedly', async () => {
    (fetchIndicatorSets as jest.Mock).mockResolvedValue([swing]);
    (deleteIndicatorSet as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<IndicatorSetPicker onApply={jest.fn()} onDuplicate={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('indicator-set-delete-set_1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('indicator-set-delete-set_1'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-picker-error')).toHaveTextContent('削除に失敗しました'),
    );
  });
});
