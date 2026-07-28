/* istanbul ignore file */
/**
 * Phase 5: シグナル定義とバックテスト実行画面。
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import type { BacktestRunDto, SignalDefinitionDto, SymbolDto } from '@market/shared-types';
import {
  ApiClientError,
  createSignalDefinition,
  deleteSignalDefinition,
  fetchBacktestRuns,
  fetchSignalDefinitions,
  fetchSymbols,
  runBacktest,
} from '../../lib/api-client';
import { getAccessToken } from '../../lib/auth-token';

export default function BacktestsPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<SignalDefinitionDto[]>([]);
  const [runs, setRuns] = useState<BacktestRunDto[]>([]);
  const [symbols, setSymbols] = useState<SymbolDto[]>([]);
  const [name, setName] = useState('SMA 5/20');
  const [symbolId, setSymbolId] = useState('');
  const [signalId, setSignalId] = useState('');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-06-30');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
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
  }, [router]);

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
      <h1 style={brandStyle}>market-platform</h1>
      <p style={leadStyle}>Signals / Backtest</p>
      <nav style={navStyle}>
        <Link href="/">トップ</Link>
        <Link href="/watchlists">ウォッチリスト</Link>
        <Link href="/portfolios">ポートフォリオ</Link>
      </nav>

      {loading ? <p style={{ opacity: 0.85 }}>読み込み中…</p> : null}
      {error ? <p style={errorStyle}>{error}</p> : null}

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>シグナル定義</h2>
        <ul style={listStyle}>
          {signals.map((signal) => (
            <li key={signal.id} style={itemRowStyle}>
              <button type="button" style={buttonStyle} onClick={() => setSignalId(signal.id)}>
                {signal.name} ({signal.strategyType})
              </button>
              <button type="button" style={buttonStyle} disabled={pending} onClick={() => void onDeleteSignal(signal.id)}>
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
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          <button type="submit" disabled={pending} style={buttonStyle}>
            実行
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>実行結果</h2>
        {runs.length === 0 ? <p style={{ opacity: 0.8 }}>まだ結果がありません</p> : null}
        <ul style={listStyle}>
          {runs.map((run) => (
            <li key={run.id}>
              {run.fromDate}〜{run.toDate} final={run.summary.finalEquity} return=
              {(run.summary.totalReturnRate * 100).toFixed(2)}% trades={run.summary.totalTrades}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '3rem 1.5rem',
  background: 'linear-gradient(160deg, #0f1c2e 0%, #1a334d 45%, #243b55 100%)',
  color: '#e8eef5',
};
const brandStyle: CSSProperties = { fontSize: 'clamp(2rem, 5vw, 3rem)', margin: 0 };
const leadStyle: CSSProperties = { marginTop: '0.75rem', opacity: 0.9 };
const navStyle: CSSProperties = { marginTop: '1rem', display: 'flex', gap: '1rem' };
const sectionStyle: CSSProperties = { marginTop: '2rem', maxWidth: '48rem' };
const sectionTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 600 };
const listStyle: CSSProperties = { listStyle: 'none', padding: 0, margin: '0.75rem 0', display: 'grid', gap: '0.5rem' };
const itemRowStyle: CSSProperties = { display: 'flex', gap: '0.75rem', alignItems: 'center' };
const formRowStyle: CSSProperties = { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' };
const formColStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '20rem' };
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
const errorStyle: CSSProperties = { color: '#ffb4a8' };
