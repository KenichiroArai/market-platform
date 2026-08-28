/* istanbul ignore file */
/**
 * バックテスト実行・結果画面（v0.3.0）。
 *
 * 売買判断は (1) 指標セットから導出する SMA/MACD/RSI か (2) チャート同系のトレンドスコア。
 * 指標トグルの編集はチャート分析側。ここではセット選択・実行・結果を扱う。
 * 「設定と実行」「結果」の2タブ。結果チャートは表示モード切替（既定: ローソク＋Buy/Sell）。
 */
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  BacktestRunDto,
  BacktestRunListItemDto,
  BacktestSignalMode,
  DailyPriceDto,
  IndicatorCatalogId,
  IndicatorDrawings,
  IndicatorSeriesPoint,
  IndicatorSetDto,
  OptimizeBacktestResultItem,
  SymbolDto,
} from '@market/shared-types';
import {
  DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS,
  backtestRunToListItem,
  describeSignalRule,
  isSignalCapableIndicatorIds,
  listCatalogSmaPairs,
  resolveSignalThresholds,
  resolveTrendScoreSignalRule,
} from '@market/shared-types';
import {
  AnalysisChart,
  computeAnalysisChartHeight,
} from '../../../components/analysis-chart';
import {
  BacktestChartDisplayModeSwitch,
  type BacktestChartDisplayMode,
} from '../../../components/backtest-chart-display-mode';
import { BacktestRunSearchPanel } from '../../../components/backtest-run-search-panel';
import { BacktestEquityChart } from '../../../components/backtest-equity-chart';
import { BacktestOverviewStrip } from '../../../components/backtest-overview-strip';
import { BacktestRunConditions } from '../../../components/backtest-run-conditions';
import { BacktestSmaOptimizeHelp } from '../../../components/backtest-sma-optimize-help';
import { BacktestSummaryCards } from '../../../components/backtest-summary-cards';
import { BacktestTradesTable } from '../../../components/backtest-trades-table';
import {
  BacktestWorkspaceTabs,
  type BacktestWorkspaceTabId,
} from '../../../components/backtest-workspace-tabs';
import {
  PopoutWindow,
  primePopoutWindow,
} from '../../../components/popout-window';
import {
  ApiClientError,
  fetchBacktestRun,
  fetchBacktestRuns,
  fetchIndicatorSets,
  fetchSymbolIndicators,
  fetchSymbolPrices,
  fetchSymbols,
  optimizeBacktest,
  runBacktest,
} from '../../../lib/api-client';
import { chartsHref, symbolsHref } from '../../../lib/app-routes';

const DEFAULT_FEE = 0.001;
const DEFAULT_SLIPPAGE = 0.001;

/** URL の indicatorSetId が一覧にあればそれを、なければ先頭（または空）を返す。 */
function resolveIndicatorSetId(
  queryValue: string | null,
  sets: IndicatorSetDto[],
): string {
  if (queryValue && sets.some((set) => set.id === queryValue)) {
    return queryValue;
  }
  return sets[0]?.id ?? '';
}

function BacktestsPageContent() {
  const searchParams = useSearchParams();
  const [indicatorSets, setIndicatorSets] = useState<IndicatorSetDto[]>([]);
  const [runList, setRunList] = useState<BacktestRunListItemDto[]>([]);
  const [runDetails, setRunDetails] = useState<Record<string, BacktestRunDto>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [symbols, setSymbols] = useState<SymbolDto[]>([]);
  const [prices, setPrices] = useState<DailyPriceDto[]>([]);
  const [indicatorPoints, setIndicatorPoints] = useState<IndicatorSeriesPoint[]>([]);
  const [drawings, setDrawings] = useState<IndicatorDrawings | undefined>(undefined);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [symbolId, setSymbolId] = useState('');
  const [indicatorSetId, setIndicatorSetId] = useState('');
  /** 既定はチャートと同系のトレンドスコア。指標セット起点も選択可。 */
  const [signalMode, setSignalMode] = useState<BacktestSignalMode>('trendScore');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-06-30');
  const [initialCash, setInitialCash] = useState(100000);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [optimizeResults, setOptimizeResults] = useState<OptimizeBacktestResultItem[]>([]);
  const [activeTab, setActiveTab] = useState<BacktestWorkspaceTabId>('setup');
  const [chartPopout, setChartPopout] = useState(false);
  /** 結果チャート表示。既定はローソク＋Buy/Sell のみ。 */
  const [chartDisplayMode, setChartDisplayMode] =
    useState<BacktestChartDisplayMode>('base');

  const selectedRun = useMemo(
    () => (selectedRunId ? (runDetails[selectedRunId] ?? null) : null),
    [runDetails, selectedRunId],
  );

  const refreshRunList = useCallback(async () => {
    const rows = await fetchBacktestRuns();
    setRunList(rows);
    setRunDetails((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (!rows.some((row) => row.id === id && row.isActive)) {
          delete next[id];
        }
      }
      return next;
    });
    setSelectedRunId((current) => {
      if (current && rows.some((row) => row.id === current && row.isActive)) {
        return current;
      }
      return rows.find((row) => row.isActive)?.id ?? '';
    });
  }, []);

  const selectedSet = useMemo(
    () => indicatorSets.find((set) => set.id === indicatorSetId) ?? null,
    [indicatorSets, indicatorSetId],
  );

  const selectedSymbol = useMemo(
    () => symbols.find((symbol) => symbol.id === symbolId) ?? null,
    [symbols, symbolId],
  );

  const runSymbol = useMemo(
    () =>
      selectedRun
        ? (symbols.find((symbol) => symbol.id === selectedRun.symbolId) ?? null)
        : null,
    [selectedRun, symbols],
  );

  const runIndicatorSet = useMemo(
    () =>
      selectedRun?.indicatorSetId
        ? (indicatorSets.find((set) => set.id === selectedRun.indicatorSetId) ?? null)
        : null,
    [selectedRun, indicatorSets],
  );

  const runEnabledIds = useMemo(() => {
    const ids = runIndicatorSet?.indicatorIds ?? [];
    return new Set<IndicatorCatalogId>(ids);
  }, [runIndicatorSet]);

  /** チャートに渡す enabledIds。基本モードでは空（ローソク＋売買のみ）。 */
  const chartEnabledIds = useMemo(() => {
    if (chartDisplayMode === 'base') {
      return new Set<IndicatorCatalogId>();
    }
    return runEnabledIds;
  }, [chartDisplayMode, runEnabledIds]);

  const selectedRulePreview = useMemo(() => {
    if (signalMode === 'trendScore') {
      return `バックテスト用: ${resolveTrendScoreSignalRule().label}（チャート分析と同系の固定採点）`;
    }
    return selectedSet ? describeSignalRule(selectedSet.indicatorIds) : null;
  }, [selectedSet, signalMode]);

  const canRunSelectedSet = useMemo(
    () => (selectedSet ? isSignalCapableIndicatorIds(selectedSet.indicatorIds) : false),
    [selectedSet],
  );

  const canRun = useMemo(() => {
    if (!symbolId) {
      return false;
    }
    if (signalMode === 'trendScore') {
      return true;
    }
    return Boolean(indicatorSetId) && canRunSelectedSet;
  }, [symbolId, signalMode, indicatorSetId, canRunSelectedSet]);

  const catalogSmaPairs = useMemo(() => listCatalogSmaPairs(), []);

  /** 指標モード時のみ指標 API を呼ぶ。 */
  const indicatorsQuery = useMemo(() => {
    if (chartDisplayMode !== 'indicators') {
      return '';
    }
    return Array.from(runEnabledIds).join(',');
  }, [chartDisplayMode, runEnabledIds]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [setRows, runRows, symbolRows] = await Promise.all([
          fetchIndicatorSets(),
          fetchBacktestRuns(),
          fetchSymbols(),
        ]);
        if (!cancelled) {
          setIndicatorSets(setRows);
          setRunList(runRows);
          setSymbols(symbolRows);
          setIndicatorSetId(resolveIndicatorSetId(searchParams.get('indicatorSetId'), setRows));
          setSymbolId(symbolRows[0]?.id ?? '');
          setSelectedRunId(runRows[0]?.id ?? '');
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
  }, [searchParams]);

  useEffect(() => {
    if (!selectedRunId) {
      return;
    }
    if (runDetails[selectedRunId]) {
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const detail = await fetchBacktestRun(selectedRunId);
        if (!cancelled) {
          setRunDetails((prev) => ({ ...prev, [detail.id]: detail }));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : '実行結果の取得に失敗しました');
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedRunId, runDetails]);

  useEffect(() => {
    if (!selectedRun) {
      setPrices([]);
      setIndicatorPoints([]);
      setDrawings(undefined);
      setChartError(null);
      setChartLoading(false);
      return;
    }

    let cancelled = false;
    setChartLoading(true);
    setChartError(null);
    void (async () => {
      try {
        const pricePromise = fetchSymbolPrices(selectedRun.symbolId, {
          from: selectedRun.fromDate,
          to: selectedRun.toDate,
        });
        const indicatorPromise =
          indicatorsQuery.length > 0
            ? fetchSymbolIndicators(selectedRun.symbolId, {
                from: selectedRun.fromDate,
                to: selectedRun.toDate,
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
          setChartError(
            priceResult.reason instanceof ApiClientError
              ? priceResult.reason.message
              : '価格の取得に失敗しました',
          );
        }

        if (indicatorResult.status === 'fulfilled') {
          setIndicatorPoints(indicatorResult.value.points);
          setDrawings(indicatorResult.value.drawings);
        } else {
          setIndicatorPoints([]);
          setDrawings(undefined);
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
  }, [selectedRun, indicatorsQuery]);

  async function onRunBacktest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!symbolId) {
      setError('銘柄を選択してください');
      return;
    }
    if (signalMode === 'indicatorSet') {
      if (!indicatorSetId) {
        setError('指標セットを選択してください');
        return;
      }
      if (!canRunSelectedSet) {
        setError(selectedRulePreview ?? '選択した指標セットではシグナルを導出できません');
        return;
      }
    }
    setError(null);
    setPending(true);
    try {
      const created = await runBacktest({
        signalMode,
        indicatorSetId: indicatorSetId || undefined,
        symbolId,
        from,
        to,
        initialCash,
        feeRate: DEFAULT_FEE,
        slippageRate: DEFAULT_SLIPPAGE,
        ...(signalMode === 'trendScore'
          ? (() => {
              const thresholds = resolveSignalThresholds({
                buyThreshold: selectedSet?.buyThreshold,
                sellThreshold: selectedSet?.sellThreshold,
              });
              return {
                buyThreshold: thresholds.buyThreshold,
                sellThreshold: thresholds.sellThreshold,
              };
            })()
          : {}),
      });
      setRunList((prev) => [backtestRunToListItem(created), ...prev]);
      setRunDetails((prev) => ({ ...prev, [created.id]: created }));
      setSelectedRunId(created.id);
      setActiveTab('results');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'バックテスト実行に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function onOptimize() {
    if (!symbolId) {
      setError('銘柄を選択してください');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await optimizeBacktest({
        symbolId,
        from,
        to,
        initialCash,
        feeRate: DEFAULT_FEE,
        slippageRate: DEFAULT_SLIPPAGE,
      });
      setOptimizeResults(response.results);
      setActiveTab('setup');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '最適化に失敗しました');
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>バックテスト</h1>
      <p style={leadStyle}>
        チャート分析と同系のトレンドスコア、または保存済み指標セット（SMA/MACD/RSI）で過去期間を検証します。指標トグルの編集はチャート分析画面で行います。
      </p>

      {loading ? <p style={{ opacity: 0.85 }}>読み込み中…</p> : null}
      {error ? <p style={errorStyle}>{error}</p> : null}
      {!loading && symbols.length === 0 ? (
        <p style={{ marginTop: '0.75rem', opacity: 0.85 }}>
          登録済みの銘柄がありません。{' '}
          <Link href={symbolsHref()} style={inlineLinkStyle}>
            銘柄を追加
          </Link>
        </p>
      ) : null}

      {!loading ? (
        <BacktestWorkspaceTabs activeTab={activeTab} onChange={setActiveTab}>
          {activeTab === 'setup' ? (
            <div>
              <p style={stepsStyle} data-testid="backtest-setup-steps">
                1. 売買判断（トレンドスコア / 指標セット）を選ぶ → 2. 銘柄・期間・資金を指定 → 3.
                実行。指標トグルの編集は
                <Link href={chartsHref()} style={inlineLinkStyle}>
                  チャート分析
                </Link>
                で行います。
              </p>
              <p style={{ margin: '0 0 0.75rem', opacity: 0.85 }}>
                <Link href={chartsHref()} style={inlineLinkStyle}>
                  指標を編集
                </Link>
              </p>
              <form onSubmit={onRunBacktest} style={formWrapStyle}>
                <fieldset style={fieldsetStyle} data-testid="signal-mode-fieldset">
                  <legend style={legendStyle}>売買判断</legend>
                  <label style={radioLabelStyle}>
                    <input
                      type="radio"
                      name="signalMode"
                      value="trendScore"
                      checked={signalMode === 'trendScore'}
                      onChange={() => setSignalMode('trendScore')}
                      data-testid="signal-mode-trend-score"
                    />
                    トレンドスコア（チャート分析と同系）
                  </label>
                  <label style={radioLabelStyle}>
                    <input
                      type="radio"
                      name="signalMode"
                      value="indicatorSet"
                      checked={signalMode === 'indicatorSet'}
                      onChange={() => setSignalMode('indicatorSet')}
                      data-testid="signal-mode-indicator-set"
                    />
                    指標セットからシグナル（SMA / MACD / RSI）
                  </label>
                </fieldset>
                <label style={labelStyle}>
                  指標セット
                  {signalMode === 'trendScore' ? '（結果チャート用・任意）' : ''}
                  <select
                    value={indicatorSetId}
                    onChange={(e) => setIndicatorSetId(e.target.value)}
                    style={inputStyle}
                    data-testid="indicator-set-select"
                  >
                    <option value="">
                      {signalMode === 'trendScore' ? 'なし（オーバーレイ無し）' : '指標セット選択'}
                    </option>
                    {indicatorSets.map((set) => {
                      const capable = isSignalCapableIndicatorIds(set.indicatorIds);
                      return (
                        <option key={set.id} value={set.id}>
                          {set.name}
                          {signalMode === 'indicatorSet' && !capable ? '（シグナル未対応）' : ''}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {selectedRulePreview ? (
                  <p style={previewStyle} data-testid="selected-set-rule-preview">
                    {selectedRulePreview}
                  </p>
                ) : null}
                <div style={symbolRowStyle}>
                  <label style={{ ...labelStyle, flex: '1 1 14rem' }}>
                    銘柄
                    <select
                      value={symbolId}
                      onChange={(e) => setSymbolId(e.target.value)}
                      style={inputStyle}
                      data-testid="symbol-select"
                    >
                      <option value="">銘柄選択</option>
                      {symbols.map((symbol) => (
                        <option key={symbol.id} value={symbol.id}>
                          {symbol.ticker} ({symbol.market}) — {symbol.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedSymbol?.name?.trim() ? (
                    <span style={symbolNameStyle} data-testid="selected-symbol-name">
                      {selectedSymbol.name}
                    </span>
                  ) : null}
                </div>
                <div style={formRowStyle}>
                  <label style={labelStyle}>
                    開始日
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    終了日
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    開始資金
                    <input
                      type="number"
                      min={1}
                      value={initialCash}
                      onChange={(e) => setInitialCash(Number(e.target.value))}
                      style={inputStyle}
                    />
                  </label>
                </div>
                <div style={formRowStyle}>
                  <button type="submit" disabled={pending || !canRun} style={buttonStyle}>
                    実行
                  </button>
                  <BacktestSmaOptimizeHelp>
                    <button
                      type="button"
                      disabled={pending}
                      style={buttonStyle}
                      onClick={() => void onOptimize()}
                      data-testid="sma-optimize-button"
                    >
                      SMA 最適化
                    </button>
                  </BacktestSmaOptimizeHelp>
                </div>
              </form>
              {symbolId ? (
                <p style={{ marginTop: '0.75rem' }}>
                  <Link href={chartsHref({ symbolId, from, to })} style={inlineLinkStyle}>
                    詳細チャート
                  </Link>
                </p>
              ) : null}

              {optimizeResults.length > 0 ? (
                <div style={{ marginTop: '1.5rem' }}>
                  <h2 style={sectionTitleStyle}>SMA 最適化結果</h2>
                  <p style={{ margin: '0.35rem 0 0.75rem', opacity: 0.85, fontSize: '0.9rem' }}>
                    カタログ SMA ペア（
                    {catalogSmaPairs.map((p) => `${p.shortPeriod}/${p.longPeriod}`).join('、')}
                    ）のみ評価します。適用する場合はチャート分析で該当 SMA を 2 本選んでセット保存してください。
                  </p>
                  <div style={wrapStyle}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          <th style={thStyle}>短期</th>
                          <th style={thStyle}>長期</th>
                          <th style={thStyle}>リターン</th>
                          <th style={thStyle}>Sharpe</th>
                          <th style={thStyle}>取引数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optimizeResults.slice(0, 20).map((item) => (
                          <tr key={`${item.shortPeriod}-${item.longPeriod}`}>
                            <td style={tdStyle}>{item.shortPeriod}</td>
                            <td style={tdStyle}>{item.longPeriod}</td>
                            <td style={tdStyle}>
                              {(item.summary.totalReturnRate * 100).toFixed(2)}%
                            </td>
                            <td style={tdStyle}>{item.summary.sharpeRatio.toFixed(3)}</td>
                            <td style={tdStyle}>{item.summary.totalTrades}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'results' ? (
            <div style={resultsStackStyle}>
              <div style={runSelectRowStyle}>
                <label style={labelStyle}>
                  実行履歴
                  <select
                    value={selectedRunId}
                    onChange={(e) => setSelectedRunId(e.target.value)}
                    style={inputStyle}
                    data-testid="backtest-run-select"
                  >
                    {runList.length === 0 ? (
                      <option value="">まだ結果がありません</option>
                    ) : null}
                    {runList.map((run) => {
                      const runSym = symbols.find((s) => s.id === run.symbolId);
                      const ticker = runSym?.ticker ?? run.symbolId;
                      return (
                        <option key={run.id} value={run.id}>
                          {ticker} {run.fromDate}〜{run.toDate} リターン=
                          {(run.summary.totalReturnRate * 100).toFixed(2)}% 取引数=
                          {run.summary.totalTrades}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => setSearchPanelOpen(true)}
                  data-testid="backtest-run-search-open"
                >
                  検索…
                </button>
              </div>

              {detailLoading && selectedRunId && !selectedRun ? (
                <p style={{ opacity: 0.85 }}>実行結果を読み込み中…</p>
              ) : null}

              <BacktestOverviewStrip
                ticker={runSymbol?.ticker ?? null}
                name={runSymbol?.name?.trim() ? runSymbol.name : null}
                fromDate={selectedRun?.fromDate ?? null}
                toDate={selectedRun?.toDate ?? null}
                summary={selectedRun?.summary ?? null}
              />

              {selectedRun ? (
                <>
                  <BacktestRunConditions
                    strategyType={selectedRun.strategyType}
                    params={selectedRun.params}
                    indicatorSetName={runIndicatorSet?.name ?? null}
                    fromDate={selectedRun.fromDate}
                    toDate={selectedRun.toDate}
                    initialCash={selectedRun.initialCash}
                    feeRate={selectedRun.feeRate}
                    slippageRate={selectedRun.slippageRate}
                  />

                  <section>
                    <h2 style={sectionTitleStyle}>結果サマリー</h2>
                    <BacktestSummaryCards summary={selectedRun.summary} />
                  </section>

                  <section>
                    <h2 style={sectionTitleStyle}>エクイティカーブ</h2>
                    <BacktestEquityChart
                      equityPoints={selectedRun.equityPoints}
                      prices={prices}
                      initialCash={selectedRun.initialCash}
                    />
                  </section>

                  <section data-testid="backtest-result-chart">
                    <div style={chartToolbarStyle}>
                      <h2 style={sectionTitleStyle}>チャート</h2>
                      <div style={chartToolbarActionsStyle}>
                        <BacktestChartDisplayModeSwitch
                          mode={chartDisplayMode}
                          onChange={setChartDisplayMode}
                        />
                        <button
                          type="button"
                          style={buttonStyle}
                          data-testid="enlarge-backtest-chart"
                          aria-pressed={chartPopout}
                          onClick={() => {
                            if (!chartPopout) {
                              primePopoutWindow('backtest-chart-fullscreen', {
                                fullscreen: true,
                              });
                            }
                            setChartPopout((open) => !open);
                          }}
                        >
                          {chartPopout ? '拡大ウィンドウを閉じる' : '拡大'}
                        </button>
                      </div>
                    </div>
                    {chartError ? <p style={errorStyle}>{chartError}</p> : null}
                    <AnalysisChart
                      prices={prices}
                      indicatorPoints={
                        chartDisplayMode === 'indicators' ? indicatorPoints : []
                      }
                      enabledIds={chartEnabledIds}
                      drawings={chartDisplayMode === 'indicators' ? drawings : undefined}
                      trades={selectedRun.trades}
                      loading={chartLoading}
                    />
                  </section>

                  <section>
                    <h2 style={sectionTitleStyle}>取引履歴</h2>
                    <BacktestTradesTable trades={selectedRun.trades} />
                  </section>
                </>
              ) : (
                <p style={{ margin: 0, opacity: 0.8 }}>実行結果を選ぶと詳細を表示します</p>
              )}
            </div>
          ) : null}
        </BacktestWorkspaceTabs>
      ) : null}

      {chartPopout && selectedRun ? (
        <PopoutWindow
          title="バックテストチャート（拡大）"
          name="backtest-chart-fullscreen"
          fullscreen
          onClose={() => setChartPopout(false)}
        >
          {({ win }) => (
            <EnlargedBacktestChart
              win={win}
              prices={prices}
              indicatorPoints={
                chartDisplayMode === 'indicators' ? indicatorPoints : []
              }
              enabledIds={chartEnabledIds}
              drawings={chartDisplayMode === 'indicators' ? drawings : undefined}
              trades={selectedRun.trades}
              loading={chartLoading}
            />
          )}
        </PopoutWindow>
      ) : null}

      {searchPanelOpen ? (
        <BacktestRunSearchPanel
          symbols={symbols}
          indicatorSets={indicatorSets}
          onClose={() => setSearchPanelOpen(false)}
          onSelectRun={(runId) => {
            setSelectedRunId(runId);
            setActiveTab('results');
          }}
          onRunsChanged={() => {
            void refreshRunList().catch((err) => {
              setError(err instanceof ApiClientError ? err.message : '一覧の更新に失敗しました');
            });
          }}
        />
      ) : null}
    </main>
  );
}

/** 別ウィンドウでも本画面と同じチャート高さで表示する。幅は popup レイアウトに任せる。 */
function EnlargedBacktestChart({
  win: _win,
  enabledIds,
  ...rest
}: {
  win: Window;
  prices: DailyPriceDto[];
  indicatorPoints: IndicatorSeriesPoint[];
  enabledIds: Set<IndicatorCatalogId>;
  drawings?: IndicatorDrawings;
  trades: BacktestRunDto['trades'];
  loading: boolean;
}) {
  const height = computeAnalysisChartHeight(enabledIds);
  return (
    <div
      data-testid="enlarged-backtest-chart"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        padding: '0.75rem',
      }}
    >
      <AnalysisChart {...rest} enabledIds={enabledIds} height={height} />
    </div>
  );
}

export default function BacktestsPage() {
  return (
    <Suspense fallback={<main style={pageStyle}>読み込み中…</main>}>
      <BacktestsPageContent />
    </Suspense>
  );
}

const pageStyle: CSSProperties = {
  padding: '2rem 1.5rem',
};
const titleStyle: CSSProperties = { fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', margin: 0 };
const leadStyle: CSSProperties = {
  margin: '0.75rem 0 0',
  maxWidth: '40rem',
  lineHeight: 1.6,
  opacity: 0.85,
};
const stepsStyle: CSSProperties = {
  margin: '0 0 1rem',
  maxWidth: '40rem',
  lineHeight: 1.6,
  opacity: 0.9,
};
const sectionTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.75rem' };
const resultsStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
};
const runSelectRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  alignItems: 'flex-end',
};
const chartToolbarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '0.25rem',
};
const chartToolbarActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  alignItems: 'center',
};
const formWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
};
const fieldsetStyle: CSSProperties = {
  margin: 0,
  padding: '0.65rem 0.75rem',
  border: '1px solid rgba(232, 238, 245, 0.25)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.45rem',
};
const legendStyle: CSSProperties = {
  padding: '0 0.35rem',
  fontSize: '0.85rem',
  opacity: 0.85,
};
const radioLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.45rem',
  fontSize: '0.9rem',
  cursor: 'pointer',
};
const formRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  alignItems: 'flex-end',
};
const symbolRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  alignItems: 'flex-end',
};
const symbolNameStyle: CSSProperties = {
  paddingBottom: '0.7rem',
  fontSize: '0.95rem',
  opacity: 0.9,
};
const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.9rem',
  minWidth: '8rem',
};
const inputStyle: CSSProperties = {
  padding: '0.65rem 0.75rem',
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0, 0, 0, 0.25)',
  color: '#e8eef5',
  font: 'inherit',
};
const buttonStyle: CSSProperties = {
  padding: '0.6rem 1rem',
  border: '1px solid rgba(232, 238, 245, 0.55)',
  background: 'transparent',
  color: '#e8eef5',
  font: 'inherit',
  cursor: 'pointer',
};
const inlineLinkStyle: CSSProperties = {
  color: '#e8eef5',
  textDecoration: 'underline',
  fontSize: '0.95rem',
};
const previewStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  opacity: 0.9,
  lineHeight: 1.5,
};
const errorStyle: CSSProperties = { color: '#ffb4a8' };
const wrapStyle: CSSProperties = { overflowX: 'auto', marginTop: '0.75rem' };
const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
};
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.35)',
  opacity: 0.85,
};
const tdStyle: CSSProperties = {
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.15)',
};
