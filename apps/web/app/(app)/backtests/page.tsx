/* istanbul ignore file */
/**
 * シグナル定義とバックテスト実行画面。
 * 開始資金・結果カード・売買マーカー・エクイティ・取引履歴・SMA 最適化を提供する。
 * 未ログイン誘導は共通レイアウト側。
 */
'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  BacktestRunDto,
  DailyPriceDto,
  OptimizeBacktestResultItem,
  SignalDefinitionDto,
  SignalStrategyParams,
  SignalStrategyType,
  SymbolDto,
} from '@market/shared-types';
import { BacktestEquityChart } from '../../../components/backtest-equity-chart';
import { BacktestSummaryCards } from '../../../components/backtest-summary-cards';
import { BacktestTradesTable } from '../../../components/backtest-trades-table';
import { PriceChart } from '../../../components/price-chart';
import {
  ApiClientError,
  createSignalDefinition,
  deleteSignalDefinition,
  fetchBacktestRuns,
  fetchSignalDefinitions,
  fetchSymbolPrices,
  fetchSymbols,
  optimizeBacktest,
  runBacktest,
} from '../../../lib/api-client';
import { chartsHref, symbolsHref } from '../../../lib/app-routes';

const DEFAULT_FEE = 0.001;
const DEFAULT_SLIPPAGE = 0.001;

function defaultParams(type: SignalStrategyType): SignalStrategyParams {
  if (type === 'smaCross') {
    return { shortPeriod: 5, longPeriod: 20 };
  }
  if (type === 'rsiThreshold') {
    return { period: 14, lower: 30, upper: 70 };
  }
  return { fast: 12, slow: 26, signal: 9 };
}

export default function BacktestsPage() {
  const [signals, setSignals] = useState<SignalDefinitionDto[]>([]);
  const [runs, setRuns] = useState<BacktestRunDto[]>([]);
  const [symbols, setSymbols] = useState<SymbolDto[]>([]);
  const [prices, setPrices] = useState<DailyPriceDto[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [name, setName] = useState('SMA 5/20');
  const [description, setDescription] = useState('');
  const [strategyType, setStrategyType] = useState<SignalStrategyType>('smaCross');
  const [params, setParams] = useState<SignalStrategyParams>(defaultParams('smaCross'));
  const [symbolId, setSymbolId] = useState('');
  const [signalId, setSignalId] = useState('');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-06-30');
  const [initialCash, setInitialCash] = useState(100000);
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [optimizeResults, setOptimizeResults] = useState<OptimizeBacktestResultItem[]>([]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [signalRows, runRows, symbolRows] = await Promise.all([
          fetchSignalDefinitions(),
          fetchBacktestRuns(),
          fetchSymbols(),
        ]);
        if (!cancelled) {
          setSignals(signalRows);
          setRuns(runRows);
          setSymbols(symbolRows);
          setSignalId(signalRows[0]?.id ?? '');
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
  }, []);

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

  function onStrategyTypeChange(next: SignalStrategyType) {
    setStrategyType(next);
    setParams(defaultParams(next));
  }

  async function onCreateSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const created = await createSignalDefinition({
        name,
        description: description.trim() || undefined,
        strategyType,
        params,
      });
      setSignals((prev) => [...prev, created]);
      setSignalId(created.id);
      setName('');
      setDescription('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'シグナル作成に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function onDeleteSignal(id: string) {
    setError(null);
    setPending(true);
    try {
      await deleteSignalDefinition(id);
      setSignals((prev) => {
        const next = prev.filter((signal) => signal.id !== id);
        setSignalId(next[0]?.id ?? '');
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'シグナル削除に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function onRunBacktest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signalId || !symbolId) {
      setError('シグナルと銘柄を選択してください');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const created = await runBacktest({
        signalDefinitionId: signalId,
        symbolId,
        from,
        to,
        initialCash,
        feeRate: DEFAULT_FEE,
        slippageRate: DEFAULT_SLIPPAGE,
      });
      setRuns((prev) => [created, ...prev]);
      setSelectedRunId(created.id);
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
        shortMin: 5,
        shortMax: 50,
        longMin: 5,
        longMax: 50,
      });
      setOptimizeResults(response.results);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '最適化に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function onApplyOptimize(item: OptimizeBacktestResultItem) {
    setError(null);
    setPending(true);
    try {
      const created = await createSignalDefinition({
        name: `SMA ${item.shortPeriod}/${item.longPeriod}`,
        strategyType: 'smaCross',
        params: { shortPeriod: item.shortPeriod, longPeriod: item.longPeriod },
      });
      setSignals((prev) => [...prev, created]);
      setSignalId(created.id);
      setStrategyType('smaCross');
      setParams({ shortPeriod: item.shortPeriod, longPeriod: item.longPeriod });
      setName(`SMA ${item.shortPeriod}/${item.longPeriod}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'シグナル作成に失敗しました');
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>シグナル / バックテスト</h1>
      <p style={leadStyle}>売買シグナルを定義し、過去期間でバックテストして検証します。</p>

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

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>シグナル定義</h2>
        <ul style={listStyle}>
          {signals.map((signal) => (
            <li key={signal.id} style={itemRowStyle}>
              <button type="button" style={buttonStyle} onClick={() => setSignalId(signal.id)}>
                {signal.name} ({signal.strategyType})
              </button>
              <button
                type="button"
                style={buttonStyle}
                disabled={pending}
                onClick={() => void onDeleteSignal(signal.id)}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={onCreateSignal} style={formColStyle}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="シグナル名"
            required
            style={inputStyle}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="説明（任意）"
            style={inputStyle}
          />
          <select
            value={strategyType}
            onChange={(e) => onStrategyTypeChange(e.target.value as SignalStrategyType)}
            style={inputStyle}
          >
            <option value="smaCross">SMA Cross</option>
            <option value="rsiThreshold">RSI Threshold</option>
            <option value="macdCross">MACD Cross</option>
          </select>
          {strategyType === 'smaCross' ? (
            <div style={formRowStyle}>
              <label style={labelStyle}>
                短期
                <input
                  type="number"
                  min={1}
                  value={(params as { shortPeriod: number }).shortPeriod}
                  onChange={(e) =>
                    setParams({
                      shortPeriod: Number(e.target.value),
                      longPeriod: (params as { longPeriod: number }).longPeriod,
                    })
                  }
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                長期
                <input
                  type="number"
                  min={2}
                  value={(params as { longPeriod: number }).longPeriod}
                  onChange={(e) =>
                    setParams({
                      shortPeriod: (params as { shortPeriod: number }).shortPeriod,
                      longPeriod: Number(e.target.value),
                    })
                  }
                  style={inputStyle}
                />
              </label>
            </div>
          ) : null}
          {strategyType === 'rsiThreshold' ? (
            <div style={formRowStyle}>
              <label style={labelStyle}>
                期間
                <input
                  type="number"
                  min={1}
                  value={(params as { period: number }).period}
                  onChange={(e) =>
                    setParams({
                      period: Number(e.target.value),
                      lower: (params as { lower: number }).lower,
                      upper: (params as { upper: number }).upper,
                    })
                  }
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                下限
                <input
                  type="number"
                  value={(params as { lower: number }).lower}
                  onChange={(e) =>
                    setParams({
                      period: (params as { period: number }).period,
                      lower: Number(e.target.value),
                      upper: (params as { upper: number }).upper,
                    })
                  }
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                上限
                <input
                  type="number"
                  value={(params as { upper: number }).upper}
                  onChange={(e) =>
                    setParams({
                      period: (params as { period: number }).period,
                      lower: (params as { lower: number }).lower,
                      upper: Number(e.target.value),
                    })
                  }
                  style={inputStyle}
                />
              </label>
            </div>
          ) : null}
          {strategyType === 'macdCross' ? (
            <div style={formRowStyle}>
              <label style={labelStyle}>
                Fast
                <input
                  type="number"
                  min={1}
                  value={(params as { fast: number }).fast}
                  onChange={(e) =>
                    setParams({
                      fast: Number(e.target.value),
                      slow: (params as { slow: number }).slow,
                      signal: (params as { signal: number }).signal,
                    })
                  }
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Slow
                <input
                  type="number"
                  min={1}
                  value={(params as { slow: number }).slow}
                  onChange={(e) =>
                    setParams({
                      fast: (params as { fast: number }).fast,
                      slow: Number(e.target.value),
                      signal: (params as { signal: number }).signal,
                    })
                  }
                  style={inputStyle}
                />
              </label>
              <label style={labelStyle}>
                Signal
                <input
                  type="number"
                  min={1}
                  value={(params as { signal: number }).signal}
                  onChange={(e) =>
                    setParams({
                      fast: (params as { fast: number }).fast,
                      slow: (params as { slow: number }).slow,
                      signal: Number(e.target.value),
                    })
                  }
                  style={inputStyle}
                />
              </label>
            </div>
          ) : null}
          <button type="submit" disabled={pending} style={buttonStyle}>
            作成
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>バックテスト実行</h2>
        <form onSubmit={onRunBacktest} style={formColStyle}>
          <select value={signalId} onChange={(e) => setSignalId(e.target.value)} style={inputStyle}>
            <option value="">シグナル選択</option>
            {signals.map((signal) => (
              <option key={signal.id} value={signal.id}>
                {signal.name}
              </option>
            ))}
          </select>
          <select value={symbolId} onChange={(e) => setSymbolId(e.target.value)} style={inputStyle}>
            <option value="">銘柄選択</option>
            {symbols.map((symbol) => (
              <option key={symbol.id} value={symbol.id}>
                {symbol.ticker} ({symbol.market})
              </option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
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
          <div style={formRowStyle}>
            <button type="submit" disabled={pending} style={buttonStyle}>
              実行
            </button>
            <button type="button" disabled={pending} style={buttonStyle} onClick={() => void onOptimize()}>
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
        {!symbolId ? (
          <p style={{ marginTop: '0.75rem', opacity: 0.85 }}>
            銘柄を選択するとチャートを表示します
          </p>
        ) : (
          <>
            {chartError ? <p style={errorStyle}>{chartError}</p> : null}
            <PriceChart prices={prices} loading={chartLoading} trades={selectedRun?.trades ?? []} />
          </>
        )}
      </section>

      {optimizeResults.length > 0 ? (
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>SMA 最適化結果</h2>
          <div style={wrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>短期</th>
                  <th style={thStyle}>長期</th>
                  <th style={thStyle}>リターン</th>
                  <th style={thStyle}>Sharpe</th>
                  <th style={thStyle}>取引数</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {optimizeResults.slice(0, 20).map((item) => (
                  <tr key={`${item.shortPeriod}-${item.longPeriod}`}>
                    <td style={tdStyle}>{item.shortPeriod}</td>
                    <td style={tdStyle}>{item.longPeriod}</td>
                    <td style={tdStyle}>{(item.summary.totalReturnRate * 100).toFixed(2)}%</td>
                    <td style={tdStyle}>{item.summary.sharpeRatio.toFixed(3)}</td>
                    <td style={tdStyle}>{item.summary.totalTrades}</td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        style={buttonStyle}
                        disabled={pending}
                        onClick={() => void onApplyOptimize(item)}
                      >
                        適用
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section style={sectionStyleWide}>
        <h2 style={sectionTitleStyle}>実行結果</h2>
        {runs.length === 0 ? <p style={{ opacity: 0.8 }}>まだ結果がありません</p> : null}
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
                {(run.summary.totalReturnRate * 100).toFixed(2)}% 取引数={run.summary.totalTrades}
              </button>
            </li>
          ))}
        </ul>

        {selectedRun ? (
          <>
            <h3 style={subTitleStyle}>結果サマリー</h3>
            <BacktestSummaryCards summary={selectedRun.summary} />
            <h3 style={subTitleStyle}>エクイティカーブ</h3>
            <BacktestEquityChart
              equityPoints={selectedRun.equityPoints}
              prices={prices}
              initialCash={selectedRun.initialCash}
            />
            <h3 style={subTitleStyle}>取引履歴</h3>
            <BacktestTradesTable trades={selectedRun.trades} />
          </>
        ) : null}
      </section>
    </main>
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
const sectionStyle: CSSProperties = { marginTop: '2rem', maxWidth: '48rem' };
const sectionStyleWide: CSSProperties = { marginTop: '2rem', maxWidth: '56rem' };
const sectionTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 600 };
const subTitleStyle: CSSProperties = { fontSize: '1rem', fontWeight: 600, marginTop: '1.5rem' };
const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '0.75rem 0',
  display: 'grid',
  gap: '0.5rem',
};
const itemRowStyle: CSSProperties = { display: 'flex', gap: '0.75rem', alignItems: 'center' };
const formRowStyle: CSSProperties = { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' };
const formColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  maxWidth: '24rem',
};
const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.9rem',
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
