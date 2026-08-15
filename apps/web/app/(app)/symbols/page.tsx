/**
 * 銘柄マスタ画面（クライアント）。
 *
 * ティッカーと市場を指定して登録する。名称・通貨・取引所は API が quote で補完する。
 * 未ログイン誘導は共通レイアウト側。
 */
'use client';

import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import type { Market, SymbolDto } from '@market/shared-types';
import { ApiClientError, createSymbol, fetchSymbols } from '../../../lib/api-client';

export default function SymbolsPage() {
  const [symbols, setSymbols] = useState<SymbolDto[]>([]);
  const [ticker, setTicker] = useState('');
  const [market, setMarket] = useState<Market>('US');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchSymbols();
        if (!cancelled) {
          setSymbols(rows);
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

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const created = await createSymbol({ ticker, market });
      setSymbols((prev) =>
        [...prev, created].sort((a, b) => {
          if (a.market !== b.market) {
            return a.market.localeCompare(b.market);
          }
          return a.ticker.localeCompare(b.ticker);
        }),
      );
      setTicker('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '登録に失敗しました');
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>銘柄</h1>
      <p style={leadStyle}>
        ティッカーと市場を指定して銘柄を追加します。名称・通貨・取引所は市場データから自動で補完します。
      </p>

      {loading ? <p style={{ opacity: 0.8 }}>読み込み中…</p> : null}
      {error ? <p style={errorStyle}>{error}</p> : null}

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>追加</h2>
        <form onSubmit={onCreate} style={formRowStyle}>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="ティッカー（例: AAPL / 7203）"
            required
            style={inputStyle}
            data-testid="ticker-input"
          />
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value as Market)}
            style={inputStyle}
            data-testid="market-select"
          >
            <option value="US">US</option>
            <option value="JP">JP</option>
          </select>
          <button type="submit" disabled={pending} style={buttonStyle}>
            追加
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>一覧</h2>
        {symbols.length === 0 && !loading ? (
          <p style={{ opacity: 0.8 }}>まだ銘柄がありません。</p>
        ) : (
          <ul style={listStyle}>
            {symbols.map((s) => (
              <li key={s.id} style={itemRowStyle}>
                <span>
                  {s.ticker} ({s.market}) — {s.name} / {s.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  padding: '2rem 1.5rem',
};
const titleStyle: CSSProperties = {
  fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
  margin: 0,
  letterSpacing: '-0.03em',
};
const leadStyle: CSSProperties = {
  margin: '0.75rem 0 0',
  maxWidth: '40rem',
  lineHeight: 1.6,
  opacity: 0.85,
};
const sectionStyle: CSSProperties = { marginTop: '2rem', maxWidth: '40rem' };
const sectionTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 600 };
const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: '0.75rem 0',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};
const formRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  marginTop: '0.75rem',
};
const itemRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'center',
};
const inputStyle: CSSProperties = {
  padding: '0.65rem 0.75rem',
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0, 0, 0, 0.25)',
  color: '#e8eef5',
  font: 'inherit',
  minWidth: '12rem',
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
