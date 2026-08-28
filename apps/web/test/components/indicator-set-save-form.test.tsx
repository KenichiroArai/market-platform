/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { GroupWeights, IndicatorCatalogId } from '@market/shared-types';
import { TREND_SCORE_GROUP_WEIGHTS } from '@market/shared-types';
import { IndicatorSetSaveForm, idsForIndicatorSet } from '../../components/indicator-set-save-form';
import { ApiClientError, createIndicatorSet, updateIndicatorSet } from '../../lib/api-client';

jest.mock('../../lib/api-client', () => ({
  createIndicatorSet: jest.fn(),
  updateIndicatorSet: jest.fn(),
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

const groupWeights: GroupWeights = { ...TREND_SCORE_GROUP_WEIGHTS };

function renderForm(overrides: Partial<Parameters<typeof IndicatorSetSaveForm>[0]> = {}) {
  const props = {
    enabledIds: new Set<IndicatorCatalogId>(['rsi']),
    indicatorParams: {},
    groupWeights,
    buyThreshold: 37.5,
    sellThreshold: -42.5,
    draftName: '',
    onDraftNameChange: jest.fn(),
    existingSets: [],
    scoreConfigValid: true,
    ...overrides,
  };
  return render(<IndicatorSetSaveForm {...props} />);
}

describe('idsForIndicatorSet', () => {
  it('drops disabled catalog ids', () => {
    expect(idsForIndicatorSet(new Set<IndicatorCatalogId>(['sma25', 'elliott']))).toEqual(['sma25']);
    expect(idsForIndicatorSet(new Set())).toEqual([]);
  });
});

describe('IndicatorSetSaveForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects empty names without calling the API', () => {
    renderForm();
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
      indicatorParams: {},
      groupWeights: null,
      buyThreshold: null,
      sellThreshold: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    (createIndicatorSet as jest.Mock).mockResolvedValue(created);
    const onSaved = jest.fn();
    const onDraftNameChange = jest.fn();
    renderForm({
      enabledIds: new Set(['rsi', 'volume']),
      draftName: 'スイング',
      onSaved,
      onDraftNameChange,
    });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-success')).toHaveTextContent('保存しました'),
    );
    expect(createIndicatorSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'スイング', indicatorIds: ['rsi', 'volume'] }),
    );
    expect(onSaved).toHaveBeenCalledWith(created);
  });

  it('overwrites when the name already exists and user confirms', async () => {
    const existing = {
      id: 'set_existing',
      userId: 'u_1',
      name: '重複',
      indicatorIds: ['sma25'],
      indicatorParams: {},
      groupWeights: null,
      buyThreshold: null,
      sellThreshold: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    (updateIndicatorSet as jest.Mock).mockResolvedValue(existing);
    renderForm({
      enabledIds: new Set(['rsi']),
      draftName: '重複',
      existingSets: [existing],
    });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-success')).toHaveTextContent('上書き保存しました'),
    );
    expect(updateIndicatorSet).toHaveBeenCalledWith('set_existing', expect.objectContaining({ name: '重複' }));
    expect(createIndicatorSet).not.toHaveBeenCalled();
  });

  it('shows ApiClientError messages', async () => {
    (createIndicatorSet as jest.Mock).mockRejectedValue(
      new ApiClientError(500, 'HTTP_ERROR', 'server error'),
    );
    renderForm({ draftName: 'X' });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-error')).toHaveTextContent('server error'),
    );
  });

  it('shows a fallback message for unexpected errors', async () => {
    (createIndicatorSet as jest.Mock).mockRejectedValue(new Error('boom'));
    renderForm({ draftName: 'X' });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-error')).toHaveTextContent('保存に失敗しました'),
    );
  });

  it('cancels overwrite when user declines confirmation', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const existing = {
      id: 'set_existing',
      userId: 'u_1',
      name: '重複',
      indicatorIds: ['sma25'],
      indicatorParams: {},
      groupWeights: null,
      buyThreshold: null,
      sellThreshold: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    renderForm({
      draftName: '重複',
      existingSets: [existing],
    });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    expect(updateIndicatorSet).not.toHaveBeenCalled();
    expect(createIndicatorSet).not.toHaveBeenCalled();
  });

  it('rejects save when score config is invalid', () => {
    renderForm({ draftName: 'X', buyThreshold: 10, sellThreshold: 20 });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    expect(screen.getByTestId('indicator-set-save-error')).toHaveTextContent('スコア設定を修正してください');
    expect(createIndicatorSet).not.toHaveBeenCalled();
  });

  it('disables the button while saving', async () => {
    let resolveSave: (value: unknown) => void = () => undefined;
    (createIndicatorSet as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    renderForm({ draftName: '待機' });
    fireEvent.click(screen.getByTestId('indicator-set-save-button'));
    expect(screen.getByTestId('indicator-set-save-button')).toBeDisabled();
    expect(screen.getByTestId('indicator-set-save-button')).toHaveTextContent('保存中…');
    resolveSave({ id: 'set_1' });
    await waitFor(() =>
      expect(screen.getByTestId('indicator-set-save-button')).toHaveTextContent('この指定を保存'),
    );
  });
});
