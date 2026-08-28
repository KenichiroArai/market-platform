/**
 * 実行履歴の条件検索・論理削除パネル（ModelessWindow）。
 *
 * 検索結果から run を選択して結果タブへ反映する。
 * 単一削除・検索結果一括削除・活動中全削除を提供する。
 */
'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  BacktestRunListItemDto,
  BacktestRunSearchQuery,
  IndicatorSetDto,
  SignalStrategyType,
  SymbolDto,
} from '@market/shared-types';
import { formatStrategyTypeShortLabel } from '@market/shared-types';
import {
  ApiClientError,
  deleteBacktestRun,
  deleteBacktestRuns,
  fetchBacktestRuns,
} from '../lib/api-client';
import { ModelessWindow } from './modeless-window';

const STRATEGY_OPTIONS: { value: '' | SignalStrategyType; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'smaCross', label: 'SMAクロス' },
  { value: 'macdCross', label: 'MACDクロス' },
  { value: 'rsiThreshold', label: 'RSI閾値' },
  { value: 'trendScoreThreshold', label: 'トレンドスコア' },
];

export type BacktestRunSearchPanelProps = {
  symbols: SymbolDto[];
  indicatorSets: IndicatorSetDto[];
  onClose: () => void;
  onSelectRun: (runId: string) => void;
  onRunsChanged: () => void;
};

type SearchFormState = {
  symbolId: string;
  strategyType: '' | SignalStrategyType;
  indicatorSetId: string;
  fromDate: string;
  toDate: string;
  createdFrom: string;
  createdTo: string;
  includeDeleted: boolean;
};

const emptyForm: SearchFormState = {
  symbolId: '',
  strategyType: '',
  indicatorSetId: '',
  fromDate: '',
  toDate: '',
  createdFrom: '',
  createdTo: '',
  includeDeleted: false,
};

/** フォーム状態を API クエリへ変換する。 */
export function buildSearchQueryFromForm(form: SearchFormState): BacktestRunSearchQuery {
  return {
    symbolId: form.symbolId || undefined,
    strategyType: form.strategyType || undefined,
    indicatorSetId: form.indicatorSetId || undefined,
    fromDate: form.fromDate || undefined,
    toDate: form.toDate || undefined,
    createdFrom: form.createdFrom || undefined,
    createdTo: form.createdTo || undefined,
    isActive: form.includeDeleted ? 'all' : true,
  };
}

/** 実行日時を一覧表示用に短くフォーマットする。 */
export function formatRunCreatedAt(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ');
}

/** 検索結果件数の表示文言。 */
export function formatSearchResultCount(total: number): string {
  return `検索結果: ${total} 件`;
}

export function BacktestRunSearchPanel({
  symbols,
  indicatorSets,
  onClose,
  onSelectRun,
  onRunsChanged,
}: BacktestRunSearchPanelProps) {
  const [form, setForm] = useState<SearchFormState>(emptyForm);
  const [appliedQuery, setAppliedQuery] = useState<BacktestRunSearchQuery>({ isActive: true });
  const [results, setResults] = useState<BacktestRunListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const symbolById = useMemo(
    () => new Map(symbols.map((symbol) => [symbol.id, symbol])),
    [symbols],
  );

  const loadResults = useCallback(async (query: BacktestRunSearchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchBacktestRuns(query);
      setResults(rows);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '検索に失敗しました');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResults(appliedQuery);
  }, [appliedQuery, loadResults]);

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    setAppliedQuery(buildSearchQueryFromForm(form));
  }

  async function handleDeleteOne(run: BacktestRunListItemDto) {
    const ticker = symbolById.get(run.symbolId)?.ticker ?? run.symbolId;
    if (
      !window.confirm(
        `${ticker} ${run.fromDate}〜${run.toDate} の実行履歴を削除しますか？`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteBacktestRun(run.id);
      onRunsChanged();
      await loadResults(appliedQuery);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '削除に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteSearchResults() {
    const activeCount = results.filter((row) => row.isActive).length;
    if (
      !window.confirm(
        `現在の検索結果 ${activeCount} 件の活動中の実行履歴を削除しますか？`,
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteBacktestRuns({ ...appliedQuery, isActive: true });
      onRunsChanged();
      await loadResults(appliedQuery);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '一括削除に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteAllActive() {
    if (!window.confirm('活動中の実行履歴をすべて削除しますか？')) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deleteBacktestRuns({ isActive: true });
      onRunsChanged();
      await loadResults(appliedQuery);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '一括削除に失敗しました');
    } finally {
      setPending(false);
    }
  }

  const activeResultCount = results.filter((row) => row.isActive).length;

  return (
    <ModelessWindow title="実行履歴の検索" onClose={onClose} width={960} initialX={48} initialY={72}>
      <form onSubmit={handleSearchSubmit} style={formStyle}>
        <label style={labelStyle}>
          銘柄
          <select
            value={form.symbolId}
            onChange={(e) => setForm((prev) => ({ ...prev, symbolId: e.target.value }))}
            style={inputStyle}
            data-testid="backtest-search-symbol"
          >
            <option value="">すべて</option>
            {symbols.map((symbol) => (
              <option key={symbol.id} value={symbol.id}>
                {symbol.ticker}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          戦略
          <select
            value={form.strategyType}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                strategyType: e.target.value as '' | SignalStrategyType,
              }))
            }
            style={inputStyle}
            data-testid="backtest-search-strategy"
          >
            {STRATEGY_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          指標セット
          <select
            value={form.indicatorSetId}
            onChange={(e) => setForm((prev) => ({ ...prev, indicatorSetId: e.target.value }))}
            style={inputStyle}
            data-testid="backtest-search-indicator-set"
          >
            <option value="">すべて</option>
            {indicatorSets.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          検証期間（開始）
          <input
            type="date"
            value={form.fromDate}
            onChange={(e) => setForm((prev) => ({ ...prev, fromDate: e.target.value }))}
            style={inputStyle}
            data-testid="backtest-search-from-date"
          />
        </label>

        <label style={labelStyle}>
          検証期間（終了）
          <input
            type="date"
            value={form.toDate}
            onChange={(e) => setForm((prev) => ({ ...prev, toDate: e.target.value }))}
            style={inputStyle}
            data-testid="backtest-search-to-date"
          />
        </label>

        <label style={labelStyle}>
          実行日（開始）
          <input
            type="date"
            value={form.createdFrom}
            onChange={(e) => setForm((prev) => ({ ...prev, createdFrom: e.target.value }))}
            style={inputStyle}
            data-testid="backtest-search-created-from"
          />
        </label>

        <label style={labelStyle}>
          実行日（終了）
          <input
            type="date"
            value={form.createdTo}
            onChange={(e) => setForm((prev) => ({ ...prev, createdTo: e.target.value }))}
            style={inputStyle}
            data-testid="backtest-search-created-to"
          />
        </label>

        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={form.includeDeleted}
            onChange={(e) => setForm((prev) => ({ ...prev, includeDeleted: e.target.checked }))}
            data-testid="backtest-search-include-deleted"
          />
          削除済みを含む
        </label>

        <button type="submit" style={buttonStyle} disabled={pending}>
          検索
        </button>
      </form>

      <div style={actionsStyle}>
        <button
          type="button"
          style={buttonStyle}
          disabled={pending || activeResultCount === 0}
          onClick={() => void handleDeleteSearchResults()}
          data-testid="backtest-delete-search-results"
        >
          検索結果をすべて削除
        </button>
        <button
          type="button"
          style={dangerButtonStyle}
          disabled={pending}
          onClick={() => void handleDeleteAllActive()}
          data-testid="backtest-delete-all-active"
        >
          活動中をすべて削除
        </button>
      </div>

      {error ? <p style={errorStyle}>{error}</p> : null}
      {loading ? <p style={hintStyle}>読み込み中…</p> : null}

      {!loading ? (
        <p style={resultCountStyle} data-testid="backtest-search-result-count">
          {formatSearchResultCount(results.length)}
        </p>
      ) : null}

      {!loading ? (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>銘柄</th>
                <th style={thStyle}>開始</th>
                <th style={thStyle}>終了</th>
                <th style={thStyle}>戦略</th>
                <th style={thStyle}>リターン</th>
                <th style={thStyle}>取引数</th>
                <th style={thStyle}>実行日</th>
                <th style={thStyle}>状態</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={9} style={tdStyle}>
                    該当する実行履歴がありません
                  </td>
                </tr>
              ) : (
                results.map((run) => {
                  const ticker = symbolById.get(run.symbolId)?.ticker ?? run.symbolId;
                  return (
                    <tr key={run.id} data-testid={`backtest-search-row-${run.id}`}>
                      <td style={tdStyle}>
                        <button
                          type="button"
                          style={linkButtonStyle}
                          onClick={() => {
                            onSelectRun(run.id);
                            onClose();
                          }}
                          data-testid={`backtest-search-select-${run.id}`}
                        >
                          {ticker}
                        </button>
                      </td>
                      <td style={tdStyle}>{run.fromDate}</td>
                      <td style={tdStyle}>{run.toDate}</td>
                      <td style={tdStyle}>{formatStrategyTypeShortLabel(run.strategyType)}</td>
                      <td style={tdStyle}>
                        {(run.summary.totalReturnRate * 100).toFixed(2)}%
                      </td>
                      <td style={tdStyle}>{run.summary.totalTrades}</td>
                      <td style={tdStyle}>{formatRunCreatedAt(run.createdAt)}</td>
                      <td style={tdStyle}>{run.isActive ? '活動中' : '削除済み'}</td>
                      <td style={tdStyle}>
                        {run.isActive ? (
                          <button
                            type="button"
                            style={dangerButtonStyle}
                            disabled={pending}
                            onClick={() => void handleDeleteOne(run)}
                            data-testid={`backtest-search-delete-${run.id}`}
                          >
                            削除
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </ModelessWindow>
  );
}

const formStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.65rem 0.75rem',
  marginBottom: '0.75rem',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  fontSize: '0.85rem',
};

const checkboxLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.85rem',
  alignSelf: 'end',
};

const inputStyle: CSSProperties = {
  padding: '0.35rem 0.45rem',
  fontSize: '0.9rem',
};

const buttonStyle: CSSProperties = {
  padding: '0.4rem 0.75rem',
  cursor: 'pointer',
  alignSelf: 'end',
};

const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: '#b00020',
  color: '#b00020',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
  marginBottom: '0.5rem',
};

const errorStyle: CSSProperties = {
  color: '#b00020',
  margin: '0.35rem 0',
  fontSize: '0.9rem',
};

const hintStyle: CSSProperties = {
  margin: '0.35rem 0',
  opacity: 0.8,
  fontSize: '0.9rem',
};

const resultCountStyle: CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '0.95rem',
  fontWeight: 600,
};

const tableWrapStyle: CSSProperties = {
  overflowX: 'auto',
  maxHeight: '320px',
  overflowY: 'auto',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.35rem 0.45rem',
  borderBottom: '1px solid #ccc',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '0.35rem 0.45rem',
  borderBottom: '1px solid #eee',
  verticalAlign: 'middle',
};

const linkButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#0066cc',
  cursor: 'pointer',
  textDecoration: 'underline',
  font: 'inherit',
};
