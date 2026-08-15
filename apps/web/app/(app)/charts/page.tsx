/**
 * Phase 6: チャート分析画面。
 *
 * 銘柄（ウォッチリスト / 検索）・期間・足種・指標トグルを選び、
 * 価格と指標を並列取得して AnalysisChart に渡す。
 * 未ログイン誘導は共通レイアウト側。
 */
'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  ChartInterval,
  DailyPriceDto,
  IndicatorSeriesPoint,
  SymbolDto,
  WatchlistDto,
} from '@market/shared-types';
import {
  AnalysisChart,
  DEFAULT_OVERLAYS,
  type AnalysisChartOverlays,
} from '../../../components/analysis-chart';
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
  const [overlays, setOverlays] = useState<AnalysisChartOverlays>(DEFAULT_OVERLAYS);
  const [prices, setPrices] = useState<DailyPriceDto[]>([]);
  const [indicatorPoints, setIndicatorPoints] = useState<IndicatorSeriesPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  // ウォッチリスト選択時は候補をその銘柄に絞る
  const watchlistSymbols = useMemo(() => {
    if (!watchlistId) {
      return symbols;
    }
    // option 由来の ID のみ想定。一致なしなら空配列（flatMap）
    return watchlists
      .filter((w) => w.id === watchlistId)
      .flatMap((w) => w.items.map((item) => item.symbol));
  }, [watchlistId, watchlists, symbols]);

  // ticker / name のクライアント側フィルタ（新規検索 API は作らない）
  const filteredSymbols = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    if (!q) {
      return watchlistSymbols;
    }
    return watchlistSymbols.filter(
      (s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }, [watchlistSymbols, symbolQuery]);

  // トグル ON の指標だけ API に要求する（不要計算を避ける）
  const indicatorsQuery = useMemo(() => {
    const types: string[] = [];
    if (overlays.sma) types.push('sma');
    if (overlays.ema) types.push('ema');
    if (overlays.rsi) types.push('rsi');
    if (overlays.macd) types.push('macd');
    return types.join(',');
  }, [overlays]);

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

  // 銘柄・期間・足種・指標セットが変わったらチャートデータを再取得
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
        // 指標がすべて OFF のときは API を呼ばず空系列にする
        const indicatorPromise =
          indicatorsQuery.length > 0
            ? fetchSymbolIndicators(symbolId, {
                from,
                to,
                interval,
                indicators: indicatorsQuery,
              })
            : Promise.resolve({ points: [] as IndicatorSeriesPoint[] });

        const [priceRows, indicatorRes] = await Promise.all([pricePromise, indicatorPromise]);
        if (!cancelled) {
          setPrices(priceRows);
          setIndicatorPoints(indicatorRes.points);
        }
      } catch (err) {
        if (!cancelled) {
          setPrices([]);
          setIndicatorPoints([]);
          setChartError(
            err instanceof ApiClientError ? err.message : 'チャートの取得に失敗しました',
          );
        }
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

  function toggleOverlay(key: keyof AnalysisChartOverlays) {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <main style={pageStyle}>
      <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem' }}>チャート分析</h1>
      <p style={{ margin: '0 0 1.25rem', opacity: 0.85, maxWidth: '40rem' }}>
        銘柄を選び、ローソク足・出来高・テクニカル指標を一体で確認します。ズーム・パンはチャート上で操作できます。
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

          <fieldset style={fieldsetStyle}>
            <legend>指標</legend>
            {(['sma', 'ema', 'rsi', 'macd'] as const).map((key) => (
              <label key={key} style={checkLabelStyle}>
                <input
                  type="checkbox"
                  checked={overlays[key]}
                  onChange={() => toggleOverlay(key)}
                  data-testid={`overlay-${key}`}
                />
                {key.toUpperCase()}
              </label>
            ))}
          </fieldset>
        </section>
      ) : null}

      {chartError ? <p style={errorStyle}>{chartError}</p> : null}

      {!loading && symbolId ? (
        <AnalysisChart
          prices={prices}
          indicatorPoints={indicatorPoints}
          overlays={overlays}
          loading={chartLoading}
        />
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
