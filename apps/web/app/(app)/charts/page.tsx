/**
 * チャート分析画面（v0.2.0 Phase 3）。
 *
 * 銘柄・期間・足種は上段、左に分類カタログ、右にローソクチャート。
 * 未ログイン誘導は共通レイアウト側。
 */
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  ChartInterval,
  DailyPriceDto,
  IndicatorCatalogId,
  IndicatorDrawings,
  IndicatorSeriesPoint,
  SymbolDto,
  WatchlistDto,
} from '@market/shared-types';
import { computeCatalogIds } from '@market/shared-types';
import { AnalysisChart } from '../../../components/analysis-chart';
import {
  INITIAL_ENABLED_IDS,
  IndicatorCatalog,
} from '../../../components/indicator-catalog';
import {
  ApiClientError,
  fetchSymbolIndicators,
  fetchSymbolPrices,
  fetchSymbols,
  fetchWatchlists,
} from '../../../lib/api-client';

export default function ChartsPage() {
  const [symbols, setSymbols] = useState<SymbolDto[]>([]);
  const [watchlists, setWatchlists] = useState<WatchlistDto[]>([]);
  const [watchlistId, setWatchlistId] = useState('');
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolId, setSymbolId] = useState('');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-06-30');
  const [interval, setInterval] = useState<ChartInterval>('1d');
  const [enabledIds, setEnabledIds] = useState<Set<IndicatorCatalogId>>(
    () => new Set(INITIAL_ENABLED_IDS),
  );
  const [prices, setPrices] = useState<DailyPriceDto[]>([]);
  const [indicatorPoints, setIndicatorPoints] = useState<IndicatorSeriesPoint[]>([]);
  const [drawings, setDrawings] = useState<IndicatorDrawings | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  const watchlistSymbols = useMemo(() => {
    if (!watchlistId) {
      return symbols;
    }
    return watchlists
      .filter((w) => w.id === watchlistId)
      .flatMap((w) => w.items.map((item) => item.symbol));
  }, [watchlistId, watchlists, symbols]);

  const filteredSymbols = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    if (!q) {
      return watchlistSymbols;
    }
    return watchlistSymbols.filter(
      (s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }, [watchlistSymbols, symbolQuery]);

  const indicatorsQuery = useMemo(() => {
    return computeCatalogIds([...enabledIds]).join(',');
  }, [enabledIds]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [symbolRows, listRows] = await Promise.all([fetchSymbols(), fetchWatchlists()]);
        if (!cancelled) {
          setSymbols(symbolRows);
          setWatchlists(listRows);
          setSymbolId(symbolRows[0]?.id ?? '');
          setWatchlistId(listRows[0]?.id ?? '');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : '読み込みに失敗しました');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!symbolId || loading) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setChartLoading(true);
      setChartError(null);
      try {
        const pricePromise = fetchSymbolPrices(symbolId, { from, to, interval });
        const indicatorPromise =
          indicatorsQuery.length > 0
            ? fetchSymbolIndicators(symbolId, {
                from,
                to,
                interval,
                indicators: indicatorsQuery,
              })
            : Promise.resolve({ points: [] as IndicatorSeriesPoint[], drawings: undefined });

        const [priceResult, indicatorResult] = await Promise.allSettled([
          pricePromise,
          indicatorPromise,
        ]);
        if (cancelled) {
          return;
        }

        if (priceResult.status === 'fulfilled') {
          setPrices(priceResult.value);
        } else {
          setPrices([]);
        }

        if (indicatorResult.status === 'fulfilled') {
          setIndicatorPoints(indicatorResult.value.points);
          setDrawings(indicatorResult.value.drawings);
        } else {
          setIndicatorPoints([]);
          setDrawings(undefined);
        }

        const messages: string[] = [];
        if (priceResult.status === 'rejected') {
          messages.push(chartFetchErrorMessage(priceResult.reason));
        }
        if (indicatorResult.status === 'rejected') {
          messages.push(chartFetchErrorMessage(indicatorResult.reason));
        }
        setChartError(messages.length > 0 ? messages.join(' / ') : null);
      } finally {
        if (!cancelled) {
          setChartLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbolId, from, to, interval, indicatorsQuery, loading]);

  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem' }}>チャート分析</h1>
      <p style={{ margin: '0 0 1.25rem', opacity: 0.85, maxWidth: '46rem' }}>
        分類からテクニカル指標を選び、ローソク足と一緒に確認します。初期表示はおすすめ構成です。ズーム・パンはチャート上で操作できます。
      </p>

      {error ? <p style={errorStyle}>{error}</p> : null}
      {loading ? <p>読み込み中…</p> : null}

      {!loading ? (
        <section style={controlsStyle}>
          <label style={labelStyle}>
            ウォッチリスト
            <select
              value={watchlistId}
              onChange={(e) => setWatchlistId(e.target.value)}
              style={inputStyle}
              data-testid="watchlist-select"
            >
              <option value="">すべて</option>
              {watchlists.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            銘柄検索
            <input
              value={symbolQuery}
              onChange={(e) => setSymbolQuery(e.target.value)}
              placeholder="ticker / 名称"
              style={inputStyle}
              data-testid="symbol-search"
            />
          </label>

          <label style={labelStyle}>
            銘柄
            <select
              value={symbolId}
              onChange={(e) => setSymbolId(e.target.value)}
              style={inputStyle}
              data-testid="symbol-select"
            >
              {filteredSymbols.length === 0 ? (
                <option value="">該当なし</option>
              ) : (
                filteredSymbols.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ticker} — {s.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label style={labelStyle}>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={inputStyle}
            />
          </label>

          <fieldset style={fieldsetStyle}>
            <legend>足種</legend>
            <label style={checkLabelStyle}>
              <input
                type="radio"
                name="interval"
                checked={interval === '1d'}
                onChange={() => setInterval('1d')}
              />
              日足
            </label>
            <label style={checkLabelStyle}>
              <input
                type="radio"
                name="interval"
                checked={interval === '1w'}
                onChange={() => setInterval('1w')}
              />
              週足
            </label>
          </fieldset>
        </section>
      ) : null}

      {chartError ? <p style={errorStyle}>{chartError}</p> : null}

      {!loading && symbolId ? (
        <div style={bodyStyle}>
          <IndicatorCatalog enabledIds={enabledIds} onChange={setEnabledIds} />
          <AnalysisChart
            prices={prices}
            indicatorPoints={indicatorPoints}
            enabledIds={enabledIds}
            drawings={drawings}
            loading={chartLoading}
          />
        </div>
      ) : null}
    </main>
  );
}

const pageStyle: CSSProperties = {
  padding: '2rem 1.5rem',
};

const controlsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1rem',
  alignItems: 'flex-end',
  marginBottom: '1rem',
};

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1.25rem',
  alignItems: 'flex-start',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.9rem',
};

const inputStyle: CSSProperties = {
  minWidth: '10rem',
  padding: '0.4rem 0.5rem',
  borderRadius: 4,
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef5',
};

const fieldsetStyle: CSSProperties = {
  border: '1px solid rgba(232, 238, 245, 0.25)',
  borderRadius: 4,
  padding: '0.5rem 0.75rem',
  margin: 0,
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
};

const checkLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  fontSize: '0.9rem',
};

const errorStyle: CSSProperties = { color: '#ffb4b4' };

function chartFetchErrorMessage(err: unknown): string {
  return err instanceof ApiClientError ? err.message : 'チャートの取得に失敗しました';
}
