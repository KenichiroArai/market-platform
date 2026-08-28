/**
 * 指標セット呼び出しウィンドウ。
 *
 * セット名と指標チェックで絞り込み、呼び出すと親の enabledIds を置き換える。
 * チャート本体のトグルはここからは直接いじらない。
 */
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  INDICATOR_CATALOG_BY_ID,
  INDICATOR_CATEGORIES,
  definitionsForCategory,
  type IndicatorCatalogId,
  type IndicatorSetDto,
} from '@market/shared-types';
import { ApiClientError, deleteIndicatorSet, fetchIndicatorSets } from '../lib/api-client';
import { filterIndicatorSets } from '../lib/indicator-set-filter';
import { toggleIndicatorId } from './indicator-catalog';

export type IndicatorSetPickerProps = {
  /** 呼び出したセットの指標 ID とセット ID（バックテスト連携用）。 */
  onApply: (set: IndicatorSetDto) => void;
  /** 複製: 指標設定へ遷移し元名をセット名欄に表示。 */
  onDuplicate: (set: IndicatorSetDto) => void;
};

/** セットに含まれる指標の表示用ラベル。 */
export function indicatorSetSummary(ids: IndicatorCatalogId[]): string {
  if (ids.length === 0) {
    return '指標なし';
  }
  return ids.map((id) => INDICATOR_CATALOG_BY_ID[id].nameJa).join('、');
}

export function IndicatorSetPicker({ onApply, onDuplicate }: IndicatorSetPickerProps) {
  const [sets, setSets] = useState<IndicatorSetDto[]>([]);
  const [nameQuery, setNameQuery] = useState('');
  const [requiredIds, setRequiredIds] = useState<Set<IndicatorCatalogId>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadSets() {
    setLoading(true);
    setError(null);
    try {
      setSets(await fetchIndicatorSets());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '読み込みに失敗しました');
      setSets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSets();
  }, []);

  const filtered = useMemo(
    () => filterIndicatorSets(sets, nameQuery, requiredIds),
    [sets, nameQuery, requiredIds],
  );

  async function onDelete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await deleteIndicatorSet(id);
      setSets((current) => current.filter((set) => set.id !== id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '削除に失敗しました');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside style={asideStyle} data-testid="indicator-set-picker">
      <label style={labelStyle}>
        セット名で検索
        <input
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          placeholder="名前の一部"
          style={inputStyle}
          data-testid="indicator-set-search-name"
        />
      </label>

      <p style={hintStyle}>含む指標で絞る（チェックした指標をすべて含むセット）</p>
      {INDICATOR_CATEGORIES.map((category) => (
        <details key={category.id} open style={detailsStyle}>
          <summary style={summaryStyle}>{category.nameJa}</summary>
          <ul style={listStyle}>
            {definitionsForCategory(category.id)
              .filter((item) => !item.disabled)
              .map((item) => (
                <li key={`${category.id}-${item.id}`}>
                  <label style={itemLabelStyle}>
                    <input
                      type="checkbox"
                      checked={requiredIds.has(item.id)}
                      onChange={() => setRequiredIds(toggleIndicatorId(requiredIds, item.id))}
                      data-testid={`set-filter-${item.id}`}
                    />
                    {item.nameJa}
                  </label>
                </li>
              ))}
          </ul>
        </details>
      ))}

      {loading ? <p data-testid="indicator-set-picker-loading">読み込み中…</p> : null}
      {error ? (
        <p style={errorStyle} data-testid="indicator-set-picker-error">
          {error}
        </p>
      ) : null}

      {!loading ? (
        <ul style={resultListStyle} data-testid="indicator-set-list">
          {filtered.length === 0 ? (
            <li style={emptyStyle}>該当するセットがありません</li>
          ) : (
            filtered.map((set) => (
              <li key={set.id} style={resultItemStyle} data-testid={`indicator-set-row-${set.id}`}>
                <div>
                  <strong>{set.name}</strong>
                  <p style={hintStyle}>{indicatorSetSummary(set.indicatorIds)}</p>
                </div>
                <div style={rowActionsStyle}>
                  <button
                    type="button"
                    style={buttonStyle}
                    data-testid={`indicator-set-apply-${set.id}`}
                    onClick={() => onApply(set)}
                  >
                    呼び出す
                  </button>
                  <button
                    type="button"
                    style={buttonStyle}
                    data-testid={`indicator-set-duplicate-${set.id}`}
                    onClick={() => onDuplicate(set)}
                  >
                    複製
                  </button>
                  <button
                    type="button"
                    style={buttonStyle}
                    disabled={busyId === set.id}
                    data-testid={`indicator-set-delete-${set.id}`}
                    onClick={() => void onDelete(set.id)}
                  >
                    削除
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </aside>
  );
}

const asideStyle: CSSProperties = {
  minWidth: '16rem',
  maxWidth: '22rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  fontSize: '0.85rem',
};

const inputStyle: CSSProperties = {
  padding: '0.35rem 0.5rem',
  borderRadius: 4,
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef5',
};

const hintStyle: CSSProperties = {
  margin: '0.2rem 0 0',
  fontSize: '0.75rem',
  opacity: 0.75,
};

const detailsStyle: CSSProperties = {
  border: '1px solid rgba(232, 238, 245, 0.2)',
  borderRadius: 4,
  padding: '0.35rem 0.6rem',
};

const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem',
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: '0.4rem 0 0',
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
};

const itemLabelStyle: CSSProperties = {
  display: 'flex',
  gap: '0.35rem',
  alignItems: 'center',
  fontSize: '0.8rem',
};

const resultListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
};

const resultItemStyle: CSSProperties = {
  border: '1px solid rgba(232, 238, 245, 0.2)',
  borderRadius: 4,
  padding: '0.5rem 0.6rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
};

const emptyStyle: CSSProperties = {
  fontSize: '0.85rem',
  opacity: 0.8,
};

const rowActionsStyle: CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
};

const buttonStyle: CSSProperties = {
  padding: '0.3rem 0.55rem',
  borderRadius: 4,
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef5',
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: '#ffb4b4',
  fontSize: '0.8rem',
};
