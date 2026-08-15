/**
 * ポートフォリオ画面（クライアント）。
 *
 * 一覧・作成・削除、保有の追加／更新／削除、通貨別集計を表示する。未ログインは /login へ誘導する。
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import type { PortfolioDto, SymbolDto } from '@market/shared-types';
import {
  ApiClientError,
  addPortfolioHolding,
  createPortfolio,
  deletePortfolio,
  fetchPortfolios,
  fetchSymbols,
  removePortfolioHolding,
  updatePortfolioHolding,
} from '../../lib/api-client';
import { getAccessToken } from '../../lib/auth-token';

export default function PortfoliosPage() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<PortfolioDto[]>([]);
  const [symbols, setSymbols] = useState<SymbolDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [symbolId, setSymbolId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [averageCost, setAverageCost] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const selected = portfolios.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const [rows, symbolRows] = await Promise.all([fetchPortfolios(), fetchSymbols()]);
        if (!cancelled) {
          setPortfolios(rows);
          setSymbols(symbolRows);
          setSelectedId(rows[0]?.id ?? null);
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

  function replacePortfolio(updated: PortfolioDto) {
    setPortfolios((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const created = await createPortfolio(newName);
      setPortfolios((prev) => [...prev, created]);
      setSelectedId(created.id);
      setNewName('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '作成に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function onDeleteSelected() {
    setError(null);
    setPending(true);
    try {
      await deletePortfolio(selected!.id);
      const deletedId = selected!.id;
      setPortfolios((prev) => {
        const next = prev.filter((p) => p.id !== deletedId);
        setSelectedId(next[0]?.id ?? null);
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '削除に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function onAddHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const updated = await addPortfolioHolding(selected!.id, {
        symbolId,
        quantity: Number(quantity),
        averageCost: Number(averageCost),
      });
      replacePortfolio(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '保有追加に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function onUpdateHolding(holdingId: string) {
    setError(null);
    setPending(true);
    try {
      const updated = await updatePortfolioHolding(selected!.id, holdingId, {
        quantity: Number(quantity),
        averageCost: Number(averageCost),
      });
      replacePortfolio(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '保有更新に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function onRemoveHolding(holdingId: string) {
    setError(null);
    setPending(true);
    try {
      const updated = await removePortfolioHolding(selected!.id, holdingId);
      replacePortfolio(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '保有削除に失敗しました');
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={pageStyle}>
      <h1 style={brandStyle}>market-platform</h1>
      <p style={leadStyle}>ポートフォリオ</p>
      <nav style={navStyle}>
        <Link href="/">トップ</Link>
        <Link href="/me">プロフィール</Link>
        <Link href="/watchlists">ウォッチリスト</Link>
      </nav>

      {loading ? <p style={{ opacity: 0.8 }}>読み込み中…</p> : null}
      {error ? <p style={errorStyle}>{error}</p> : null}

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>ポートフォリオ一覧</h2>
        <ul style={listStyle}>
          {portfolios.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                style={{
                  ...buttonStyle,
                  borderColor:
                    p.id === selectedId ? 'rgba(232, 238, 245, 0.9)' : 'rgba(232, 238, 245, 0.35)',
                }}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={onCreate} style={formRowStyle}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新しいポートフォリオ名"
            required
            style={inputStyle}
          />
          <button type="submit" disabled={pending} style={buttonStyle}>
            作成
          </button>
        </form>
        {selected ? (
          <button type="button" onClick={onDeleteSelected} disabled={pending} style={buttonStyle}>
            選択中を削除
          </button>
        ) : null}
      </section>

      {selected ? (
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>{selected.name}</h2>
          <h3 style={subTitleStyle}>通貨別集計</h3>
          {selected.totalsByCurrency.length === 0 ? (
            <p style={{ opacity: 0.8 }}>保有がありません</p>
          ) : (
            <ul style={listStyle}>
              {selected.totalsByCurrency.map((t) => (
                <li key={t.currency}>
                  {t.currency}: cost={t.totalCost}, market={t.totalMarketValue}, pnl=
                  {t.unrealizedPnl}
                </li>
              ))}
            </ul>
          )}

          <h3 style={subTitleStyle}>保有</h3>
          <ul style={listStyle}>
            {selected.holdings.map((h) => (
              <li key={h.id} style={itemColStyle}>
                <span>
                  {h.symbol.ticker} qty={h.quantity} avg={h.averageCost} price=
                  {h.marketPrice ?? 'n/a'} pnl={h.unrealizedPnl ?? 'n/a'}
                </span>
                <div style={formRowStyle}>
                  <button
                    type="button"
                    onClick={() => void onUpdateHolding(h.id)}
                    disabled={pending}
                    style={buttonStyle}
                  >
                    数量/単価を反映
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRemoveHolding(h.id)}
                    disabled={pending}
                    style={buttonStyle}
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <form onSubmit={onAddHolding} style={formColStyle}>
            <select
              value={symbolId}
              onChange={(e) => setSymbolId(e.target.value)}
              style={inputStyle}
            >
              {symbols.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ticker} ({s.market})
                </option>
              ))}
            </select>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={0}
              step="any"
              required
              placeholder="数量"
              style={inputStyle}
            />
            <input
              type="number"
              value={averageCost}
              onChange={(e) => setAverageCost(e.target.value)}
              min={0}
              step="any"
              required
              placeholder="平均取得単価"
              style={inputStyle}
            />
            <button type="submit" disabled={pending || symbols.length === 0} style={buttonStyle}>
              保有を追加
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: '3rem 1.5rem',
  background: 'linear-gradient(160deg, #0f1c2e 0%, #1a334d 45%, #243b55 100%)',
  color: '#e8eef5',
};
const brandStyle: CSSProperties = {
  fontSize: 'clamp(2rem, 5vw, 3rem)',
  margin: 0,
  letterSpacing: '-0.03em',
};
const leadStyle: CSSProperties = { marginTop: '0.75rem', opacity: 0.9 };
const navStyle: CSSProperties = { marginTop: '1rem', display: 'flex', gap: '1rem' };
const sectionStyle: CSSProperties = { marginTop: '2rem', maxWidth: '44rem' };
const sectionTitleStyle: CSSProperties = { fontSize: '1.1rem', fontWeight: 600 };
const subTitleStyle: CSSProperties = { fontSize: '1rem', marginTop: '1.25rem' };
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
const formColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginTop: '1rem',
  maxWidth: '22rem',
};
const itemColStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
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
const errorStyle: CSSProperties = { color: '#ffb4a8' };
