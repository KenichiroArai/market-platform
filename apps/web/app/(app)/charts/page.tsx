/**
 * チャート分析画面（v0.2.0 Phase 6）。
 *
 * 銘柄・期間・足種は上段、チャートは本画面に全幅表示する。
 * 指標カタログはモードレスまたは別ウィンドウ。拡大は全画面の別ウィンドウ。
 * 指標セットの保存は指標設定ウィンドウ内、呼び出しは独立ウィンドウ。
 * トレンドスコアはトグル非依存で背景色に出し、基準日クリックで内訳を見る。
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
  TrendScorePoint,
  WatchlistDto,
} from '@market/shared-types';
import { computeCatalogIds } from '@market/shared-types';
import {
  AnalysisChart,
  computeAnalysisChartHeight,
  resolveScoredPoint,
} from '../../../components/analysis-chart';
import {
  INITIAL_ENABLED_IDS,
  IndicatorCatalog,
} from '../../../components/indicator-catalog';
import { IndicatorSetPicker } from '../../../components/indicator-set-picker';
import { IndicatorSetSaveForm } from '../../../components/indicator-set-save-form';
import { ModelessWindow } from '../../../components/modeless-window';
import {
  enlargedChartHeight,
  nextIndicatorUiMode,
  type IndicatorUiMode,
} from '../../../components/chart-window-state';
import {
  PopoutWindow,
  primePopoutWindow,
  useHostWindowSize,
} from '../../../components/popout-window';
import { TrendScoreBreakdown } from '../../../components/trend-score-breakdown';
import {
  ApiClientError,
  fetchSymbolIndicators,
  fetchSymbolPrices,
  fetchSymbolTrendScore,
  fetchSymbols,
  fetchWatchlists,
} from '../../../lib/api-client';
import { defaultChartFromDate, defaultChartToDate } from '../../../lib/chart-date-range';

export default function ChartsPage() {
  const [symbols, setSymbols] = useState<SymbolDto[]>([]);
  const [watchlists, setWatchlists] = useState<WatchlistDto[]>([]);
  const [watchlistId, setWatchlistId] = useState('');
  const [symbolQuery, setSymbolQuery] = useState('');
  const [symbolId, setSymbolId] = useState('');
  const [from, setFrom] = useState(() => defaultChartFromDate());
  const [to, setTo] = useState(() => defaultChartToDate());
  const [interval, setInterval] = useState<ChartInterval>('1d');
  const [enabledIds, setEnabledIds] = useState<Set<IndicatorCatalogId>>(
    () => new Set(INITIAL_ENABLED_IDS),
  );
  const [prices, setPrices] = useState<DailyPriceDto[]>([]);
  const [indicatorPoints, setIndicatorPoints] = useState<IndicatorSeriesPoint[]>([]);
  const [trendScorePoints, setTrendScorePoints] = useState<TrendScorePoint[]>([]);
  const [drawings, setDrawings] = useState<IndicatorDrawings | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [indicatorUi, setIndicatorUi] = useState<IndicatorUiMode>('closed');
  const [recallUi, setRecallUi] = useState<IndicatorUiMode>('closed');
  const [scoreUi, setScoreUi] = useState<'closed' | 'modeless'>('closed');
  const [chartPopout, setChartPopout] = useState(false);
  /** スコア内訳の基準日。未選択時は直近の有効スコア日。 */
  const [baseDate, setBaseDate] = useState<string | null>(null);

  /** 呼び出しウィンドウから選んだセットを現行の指標指定へ反映する。 */
  function applyIndicatorSet(ids: IndicatorCatalogId[]) {
    setEnabledIds(new Set(ids));
  }

  /** 呼び出しウィンドウを閉じる（モードレス / 別ウィンドウ共通）。 */
  function closeRecallUi() {
    setRecallUi('closed');
  }

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

  const scoredPoint = useMemo(
    () => resolveScoredPoint(trendScorePoints, baseDate),
    [trendScorePoints, baseDate],
  );

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
      // 銘柄・期間・足種が変わったら基準日は直近に戻す
      setBaseDate(null);
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
        const trendPromise = fetchSymbolTrendScore(symbolId, { from, to, interval });

        const [priceResult, indicatorResult, trendResult] = await Promise.allSettled([
          pricePromise,
          indicatorPromise,
          trendPromise,
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

        if (trendResult.status === 'fulfilled') {
          setTrendScorePoints(trendResult.value.points);
        } else {
          setTrendScorePoints([]);
        }

        const messages: string[] = [];
        if (priceResult.status === 'rejected') {
          messages.push(chartFetchErrorMessage(priceResult.reason));
        }
        if (indicatorResult.status === 'rejected') {
          messages.push(chartFetchErrorMessage(indicatorResult.reason));
        }
        if (trendResult.status === 'rejected') {
          messages.push(chartFetchErrorMessage(trendResult.reason));
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
        チャートは本画面に表示します。指標はモードレスまたは別ウィンドウで選び、拡大で全画面の別ウィンドウを開けます。初期表示はおすすめ構成です。背景色はトレンドスコアです。チャートをクリックすると基準日が変わり、スコア内訳ウィンドウでグループと個別の点数を確認できます。
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

      {!loading ? (
        <section style={windowActionsStyle}>
          <button
            type="button"
            style={buttonStyle}
            data-testid="open-indicator-modeless"
            aria-pressed={indicatorUi === 'modeless'}
            onClick={() => setIndicatorUi((current) => nextIndicatorUiMode(current, 'modeless'))}
          >
            指標設定（モードレス）
          </button>
          <button
            type="button"
            style={buttonStyle}
            data-testid="open-indicator-popout"
            aria-pressed={indicatorUi === 'popout'}
            onClick={() => {
              const next = nextIndicatorUiMode(indicatorUi, 'popout');
              if (next === 'popout') {
                primePopoutWindow('chart-indicator-settings', { width: 440, height: 800 });
              }
              setIndicatorUi(next);
            }}
          >
            指標設定（別ウィンドウ）
          </button>
          <button
            type="button"
            style={buttonStyle}
            data-testid="open-indicator-set-modeless"
            aria-pressed={recallUi === 'modeless'}
            onClick={() => setRecallUi((current) => nextIndicatorUiMode(current, 'modeless'))}
          >
            指標セット呼び出し（モードレス）
          </button>
          <button
            type="button"
            style={buttonStyle}
            data-testid="open-indicator-set-popout"
            aria-pressed={recallUi === 'popout'}
            onClick={() => {
              const next = nextIndicatorUiMode(recallUi, 'popout');
              if (next === 'popout') {
                primePopoutWindow('chart-indicator-set-picker', { width: 440, height: 800 });
              }
              setRecallUi(next);
            }}
          >
            指標セット呼び出し（別ウィンドウ）
          </button>
          <button
            type="button"
            style={buttonStyle}
            data-testid="open-score-breakdown"
            aria-pressed={scoreUi === 'modeless'}
            onClick={() =>
              setScoreUi((current) => (current === 'modeless' ? 'closed' : 'modeless'))
            }
          >
            スコア内訳
          </button>
          <span style={countStyle} data-testid="enabled-indicator-count">
            選択中 {enabledIds.size} 件
          </span>
        </section>
      ) : null}

      {chartError ? <p style={errorStyle}>{chartError}</p> : null}

      {!loading && symbolId ? (
        <section style={chartPanelStyle} data-testid="chart-panel">
          <div style={chartToolbarStyle}>
            <h2 style={chartTitleStyle}>チャート</h2>
            <button
              type="button"
              style={buttonStyle}
              data-testid="enlarge-chart"
              aria-pressed={chartPopout}
              onClick={() => {
                if (!chartPopout) {
                  primePopoutWindow('chart-analysis-fullscreen', { fullscreen: true });
                }
                setChartPopout((open) => !open);
              }}
            >
              {chartPopout ? '拡大ウィンドウを閉じる' : '拡大'}
            </button>
          </div>
          <AnalysisChart
            prices={prices}
            indicatorPoints={indicatorPoints}
            enabledIds={enabledIds}
            drawings={drawings}
            trendScorePoints={trendScorePoints}
            baseDate={baseDate}
            onBarClick={setBaseDate}
            loading={chartLoading}
          />
        </section>
      ) : null}

      {indicatorUi === 'modeless' ? (
        <ModelessWindow title="指標設定" onClose={() => setIndicatorUi('closed')}>
          <div style={windowBodyStyle}>
            <IndicatorSetSaveForm enabledIds={enabledIds} />
            <IndicatorCatalog enabledIds={enabledIds} onChange={setEnabledIds} />
          </div>
        </ModelessWindow>
      ) : null}

      {indicatorUi === 'popout' ? (
        <PopoutWindow
          title="指標設定"
          name="chart-indicator-settings"
          padded
          onClose={() => setIndicatorUi('closed')}
        >
          <div style={windowBodyStyle}>
            <IndicatorSetSaveForm enabledIds={enabledIds} />
            <IndicatorCatalog enabledIds={enabledIds} onChange={setEnabledIds} />
          </div>
        </PopoutWindow>
      ) : null}

      {recallUi === 'modeless' ? (
        <ModelessWindow
          title="指標セット呼び出し"
          initialX={400}
          onClose={closeRecallUi}
        >
          <IndicatorSetPicker onApply={applyIndicatorSet} />
        </ModelessWindow>
      ) : null}

      {recallUi === 'popout' ? (
        <PopoutWindow
          title="指標セット呼び出し"
          name="chart-indicator-set-picker"
          padded
          onClose={closeRecallUi}
        >
          <IndicatorSetPicker onApply={applyIndicatorSet} />
        </PopoutWindow>
      ) : null}

      {scoreUi === 'modeless' ? (
        <ModelessWindow
          title="スコア内訳"
          initialX={48}
          initialY={140}
          width={720}
          onClose={() => setScoreUi('closed')}
        >
          <TrendScoreBreakdown point={scoredPoint} />
        </ModelessWindow>
      ) : null}

      {chartPopout ? (
        <PopoutWindow
          title="チャート分析（拡大）"
          name="chart-analysis-fullscreen"
          fullscreen
          onClose={() => setChartPopout(false)}
        >
          {({ win }) => (
            <EnlargedAnalysisChart
              win={win}
              prices={prices}
              indicatorPoints={indicatorPoints}
              enabledIds={enabledIds}
              drawings={drawings}
              trendScorePoints={trendScorePoints}
              baseDate={baseDate}
              onBarClick={setBaseDate}
              loading={chartLoading}
            />
          )}
        </PopoutWindow>
      ) : null}
    </main>
  );
}

/** 別ウィンドウ側の高さに合わせてチャートを引き伸ばす。 */
function EnlargedAnalysisChart({
  win,
  enabledIds,
  ...rest
}: {
  win: Window;
  prices: DailyPriceDto[];
  indicatorPoints: IndicatorSeriesPoint[];
  enabledIds: Set<IndicatorCatalogId>;
  drawings?: IndicatorDrawings;
  trendScorePoints?: TrendScorePoint[];
  baseDate?: string | null;
  onBarClick?: (date: string) => void;
  loading: boolean;
}) {
  const size = useHostWindowSize(win);
  const minHeight = computeAnalysisChartHeight(enabledIds);
  return (
    <AnalysisChart
      {...rest}
      enabledIds={enabledIds}
      height={enlargedChartHeight(minHeight, size.height)}
    />
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

const windowActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  alignItems: 'center',
  marginBottom: '1rem',
};

const windowBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const buttonStyle: CSSProperties = {
  padding: '0.4rem 0.75rem',
  borderRadius: 4,
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef5',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

const countStyle: CSSProperties = {
  fontSize: '0.85rem',
  opacity: 0.8,
};

const chartPanelStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
};

const chartToolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  marginBottom: '0.35rem',
};

const chartTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.05rem',
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
