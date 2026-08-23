/* istanbul ignore file */
/**
 * シグナル定義とバックテスト実行画面。
 * 銘柄・期間の選択に連動して日足終値チャートを表示する。
 * 未ログイン誘導は共通レイアウト側。
 */
'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import type {
  BacktestRunDto,
  DailyPriceDto,
  SignalDefinitionDto,
  SymbolDto,
} from '@market/shared-types';
import { PriceChart } from '../../../components/price-chart';
import {
  ApiClientError,
  createSignalDefinition,
  deleteSignalDefinition,
  fetchBacktestRuns,
  fetchSignalDefinitions,
  fetchSymbolPrices,
  fetchSymbols,
  runBacktest,
} from '../../../lib/api-client';
import { chartsHref, symbolsHref } from '../../../lib/app-routes';

export default function BacktestsPage() {
  const [signals, setSignals] = useState<SignalDefinitionDto[]>([]);
  const [runs, setRuns] = useState<BacktestRunDto[]>([]);
  const [symbols, setSymbols] = useState<SymbolDto[]>([]);
  const [prices, setPrices] = useState<DailyPriceDto[]>([]);
  const [name, setName] = useState('SMA 5/20');
  const [symbolId, setSymbolId] = useState('');
  const [signalId, setSignalId] = useState('');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-06-30');
  const [error, setError] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [pending, setPending] = useState(false);

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

  /** 銘柄・期間が変わったら価格を取り直しチャートを更新する。 */
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

  async function onCreateSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const created = await createSignalDefinition({
        name,
        strategyType: 'smaCross',
        params: { shortPeriod: 5, longPeriod: 20 },
      });
      setSignals((prev) => [...prev, created]);
      setSignalId(created.id);
      setName('');
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
        initialCash: 100000,
        feeRate: 0.001,
        slippageRate: 0.001,
      });
      setRuns((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'バックテスト実行に失敗しました');
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
        <form onSubmit={onCreateSignal} style={formRowStyle}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="シグナル名"
            required
            style={inputStyle}
          />
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
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={inputStyle}
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={pending} style={buttonStyle}>
            実行
          </button>
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
            <PriceChart prices={prices} loading={chartLoading} />
          </>
        )}
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>実行結果</h2>
        {runs.length === 0 ? <p style={{ opacity: 0.8 }}>まだ結果がありません</p> : null}
        <ul style={listStyle}>
          {runs.map((run) => (
            <li key={run.id}>
              {run.fromDate}〜{run.toDate} 最終資産={run.summary.finalEquity} リターン=
              {(run.summary.totalReturnRate * 100).toFixed(2)}% 取引数={run.summary.totalTrades}
            </li>
          ))}
        </ul>
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
const sectionTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 600 };
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
  maxWidth: '20rem',
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
