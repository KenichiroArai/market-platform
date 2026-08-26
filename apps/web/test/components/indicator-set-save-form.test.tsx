/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IndicatorCatalogId } from '@market/shared-types';
import { IndicatorSetSaveForm, idsForIndicatorSet } from '../../components/indicator-set-save-form';
import { ApiClientError, createIndicatorSet } from '../../lib/api-client';

jest.mock('../../lib/api-client', () => ({
  createIndicatorSet: jest.fn(),
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

describe('idsForIndicatorSet', () => {
  it('drops disabled catalog ids', () => {
    expect(idsForIndicatorSet(new Set<IndicatorCatalogId>(['sma25', 'elliott']))).toEqual(['sma25']);
    expect(idsForIndicatorSet(new Set())).toEqual([]);
  });
});

describe('IndicatorSetSaveForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects empty names without calling the API', () => {
    render(<IndicatorSetSaveForm enabledIds={new Set(['rsi'])} />);
    fireEvent.submit(screen.getByTestId('indicator-set-save'));
    expect(screen.getByTestId('indicator-set-save-error')).toHaveTextContent('セット名を入力してください');
    expect(createIndicatorSet).not.toHaveBeenCalled();
  });

  it('saves the current ids and shows success', async () => {
    const created = {
      id: 'set_1',
      userId: 'u_1',
      name: 'スイング',
      indicatorIds: ['rsi', 'volume'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    (createIndicatorSet as jest.Mock).mockResolvedValue(created);
    const onSaved = jest.fn();
    render(<IndicatorSetSaveForm enabledIds={new Set(['rsi', 'volume'])} onSaved={onSaved} />);
    fireEvent.change(screen.getByTestId('indicator-set-name'), { target: { value: ' スイング ' } });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-success')).toHaveTextContent('保存しました'),
    );
    expect(createIndicatorSet).toHaveBeenCalledWith('スイング', ['rsi', 'volume']);
    expect(onSaved).toHaveBeenCalledWith(created);
    expect(screen.getByTestId('indicator-set-name')).toHaveValue('');
  });

  it('shows ApiClientError messages', async () => {
    (createIndicatorSet as jest.Mock).mockRejectedValue(
      new ApiClientError(409, 'INDICATOR_SET_ALREADY_EXISTS', 'Indicator set name already exists'),
    );
    render(<IndicatorSetSaveForm enabledIds={new Set(['sma25'])} />);
    fireEvent.change(screen.getByTestId('indicator-set-name'), { target: { value: '重複' } });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-error')).toHaveTextContent(
        'Indicator set name already exists',
      ),
    );
  });

  it('shows a fallback message for unexpected errors', async () => {
    (createIndicatorSet as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<IndicatorSetSaveForm enabledIds={new Set(['sma25'])} />);
    fireEvent.change(screen.getByTestId('indicator-set-name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-error')).toHaveTextContent('保存に失敗しました'),
    );
  });

  it('disables the button while saving', async () => {
    let resolveSave: (value: unknown) => void = () => undefined;
    (createIndicatorSet as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<IndicatorSetSaveForm enabledIds={new Set(['sma25'])} />);
    fireEvent.change(screen.getByTestId('indicator-set-name'), { target: { value: '待機' } });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    expect(screen.getByTestId('indicator-set-save-button')).toBeDisabled();
    expect(screen.getByTestId('indicator-set-save-button')).toHaveTextContent('保存中…');
    resolveSave({ id: 'set_1' });
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-button')).toHaveTextContent('この指定を保存'),
    );
  });
});
