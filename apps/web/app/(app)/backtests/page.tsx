/* istanbul ignore file */
/**
 * バックテスト実行・結果画面（v0.3.0 Ph4）。
 *
 * 指標設定はチャート分析側。ここでは保存済み指標セットを選び実行する。
 * 概要帯で銘柄・主要指標を常時表示し、詳細はタブで切り替える。
 * 未ログイン誘導は共通レイアウト側。
 */
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  BacktestRunDto,
  DailyPriceDto,
  IndicatorSetDto,
  OptimizeBacktestResultItem,
  SymbolDto,
} from '@market/shared-types';
import {
  describeSignalRule,
  isSignalCapableIndicatorIds,
  listCatalogSmaPairs,
} from '@market/shared-types';
import { BacktestEquityChart } from '../../../components/backtest-equity-chart';
import { BacktestOverviewStrip } from '../../../components/backtest-overview-strip';
import { BacktestSummaryCards } from '../../../components/backtest-summary-cards';
import { BacktestTradesTable } from '../../../components/backtest-trades-table';
import {
  BacktestWorkspaceTabs,
  type BacktestWorkspaceTabId,
} from '../../../components/backtest-workspace-tabs';
import { PriceChart } from '../../../components/price-chart';
import {
  ApiClientError,
  fetchBacktestRuns,
  fetchIndicatorSets,
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
  const [runs, setRuns] = useState<BacktestRunDto[]>([]);
  const [symbols, setSymbols] = useState<SymbolDto[]>([]);
  const [prices, setPrices] = useState<DailyPriceDto[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [symbolId, setSymbolId] = useState('');
  const [indicatorSetId, setIndicatorSetId] = useState('');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-06-30');
  const [initialCash, setInitialCash] = useState(100000);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [optimizeResults, setOptimizeResults] = useState<OptimizeBacktestResultItem[]>([]);
  const [activeTab, setActiveTab] = useState<BacktestWorkspaceTabId>('run');

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );

  const selectedSet = useMemo(
    () => indicatorSets.find((set) => set.id === indicatorSetId) ?? null,
    [indicatorSets, indicatorSetId],
  );

  const selectedSymbol = useMemo(
    () => symbols.find((symbol) => symbol.id === symbolId) ?? null,
    [symbols, symbolId],
  );

  const selectedRulePreview = useMemo(
    () => (selectedSet ? describeSignalRule(selectedSet.indicatorIds) : null),
    [selectedSet],
  );

  const canRunSelectedSet = useMemo(
    () => (selectedSet ? isSignalCapableIndicatorIds(selectedSet.indicatorIds) : false),
    [selectedSet],
  );

  const catalogSmaPairs = useMemo(() => listCatalogSmaPairs(), []);

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
          setRuns(runRows);
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
    if (!symbolId) {
      setPrices([]);
      setChartError(null);
      setChartLoading(false);
      return;
    }

    let cancelled = false;
    setChartLoading(true);
    setChartError(null);
    void (async () => {
      try {
        const rows = await fetchSymbolPrices(symbolId, { from, to });
        if (!cancelled) {
          setPrices(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setPrices([]);
          setChartError(err instanceof ApiClientError ? err.message : '価格の取得に失敗しました');
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
  }, [symbolId, from, to]);

  async function onRunBacktest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!indicatorSetId || !symbolId) {
      setError('指標セットと銘柄を選択してください');
      return;
    }
    if (!canRunSelectedSet) {
      setError(selectedRulePreview ?? '選択した指標セットではシグナルを導出できません');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const created = await runBacktest({
        indicatorSetId,
        symbolId,
        from,
        to,
        initialCash,
        feeRate: DEFAULT_FEE,
        slippageRate: DEFAULT_SLIPPAGE,
      });
      setRuns((prev) => [created, ...prev]);
      setSelectedRunId(created.id);
      setActiveTab('summary');
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
      setActiveTab('run');
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
        チャート分析で保存した指標セットを選び、過去期間でバックテストします。指標の編集はチャート分析画面で行います。
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
        <>
          <BacktestOverviewStrip
            ticker={selectedSymbol?.ticker ?? null}
            name={selectedSymbol?.name?.trim() ? selectedSymbol.name : null}
            fromDate={selectedRun?.fromDate ?? null}
            toDate={selectedRun?.toDate ?? null}
            summary={selectedRun?.summary ?? null}
          />

          <BacktestWorkspaceTabs activeTab={activeTab} onChange={setActiveTab}>
            {activeTab === 'run' ? (
              <div>
                <p style={{ margin: '0 0 0.75rem', opacity: 0.85 }}>
                  <Link href={chartsHref()} style={inlineLinkStyle}>
                    指標を編集
                  </Link>
                </p>
                <form onSubmit={onRunBacktest} style={formWrapStyle}>
                  <label style={labelStyle}>
                    指標セット
                    <select
                      value={indicatorSetId}
                      onChange={(e) => setIndicatorSetId(e.target.value)}
                      style={inputStyle}
                      data-testid="indicator-set-select"
                    >
                      <option value="">指標セット選択</option>
                      {indicatorSets.map((set) => {
                        const capable = isSignalCapableIndicatorIds(set.indicatorIds);
                        return (
                          <option key={set.id} value={set.id}>
                            {set.name}
                            {capable ? '' : '（シグナル未対応）'}
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
                    <button type="submit" disabled={pending || !canRunSelectedSet} style={buttonStyle}>
                      実行
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      style={buttonStyle}
                      onClick={() => void onOptimize()}
                    >
                      SMA 最適化
                    </button>
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

            {activeTab === 'chart' ? (
              <div>
                {!symbolId ? (
                  <p style={{ margin: 0, opacity: 0.85 }}>銘柄を選択するとチャートを表示します</p>
                ) : (
                  <>
                    {chartError ? <p style={errorStyle}>{chartError}</p> : null}
                    <PriceChart
                      prices={prices}
                      loading={chartLoading}
                      trades={selectedRun?.trades ?? []}
                    />
                  </>
                )}
              </div>
            ) : null}

            {activeTab === 'runs' ? (
              <div>
                {runs.length === 0 ? (
                  <p style={{ margin: 0, opacity: 0.8 }}>まだ結果がありません</p>
                ) : null}
                <ul style={listStyle}>
                  {runs.map((run) => (
                    <li key={run.id}>
                      <button
                        type="button"
                        style={{
                          ...buttonStyle,
                          fontWeight: selectedRun?.id === run.id ? 700 : 400,
                          borderColor:
                            selectedRun?.id === run.id
                              ? 'rgba(126, 184, 255, 0.9)'
                              : 'rgba(232, 238, 245, 0.55)',
                        }}
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        {run.fromDate}〜{run.toDate} リターン=
                        {(run.summary.totalReturnRate * 100).toFixed(2)}% 取引数=
                        {run.summary.totalTrades}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {activeTab === 'summary' ? (
              <div>
                {selectedRun ? (
                  <BacktestSummaryCards summary={selectedRun.summary} />
                ) : (
                  <p style={{ margin: 0, opacity: 0.8 }}>実行結果を選ぶとサマリーを表示します</p>
                )}
              </div>
            ) : null}

            {activeTab === 'equity' ? (
              <div>
                {selectedRun ? (
                  <BacktestEquityChart
                    equityPoints={selectedRun.equityPoints}
                    prices={prices}
                    initialCash={selectedRun.initialCash}
                  />
                ) : (
                  <p style={{ margin: 0, opacity: 0.8 }}>
                    実行結果を選ぶとエクイティカーブを表示します
                  </p>
                )}
              </div>
            ) : null}

            {activeTab === 'trades' ? (
              <div>
                {selectedRun ? (
                  <BacktestTradesTable trades={selectedRun.trades} />
                ) : (
                  <p style={{ margin: 0, opacity: 0.8 }}>実行結果を選ぶと取引履歴を表示します</p>
                )}
              </div>
            ) : null}
          </BacktestWorkspaceTabs>
        </>
      ) : null}
    </main>
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
const sectionTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 600, margin: 0 };
const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '0.75rem 0',
  display: 'grid',
  gap: '0.5rem',
};
const formWrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
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
