/**
 * ウォッチリスト画面（クライアント）。
 *
 * 一覧・作成・削除、選択中リストへの銘柄追加／削除を行う。
 * 未ログイン誘導は共通レイアウト側。
 */
'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import type { SymbolDto, WatchlistDto } from '@market/shared-types';
import {
  ApiClientError,
  addWatchlistItem,
  createWatchlist,
  deleteWatchlist,
  fetchSymbols,
  fetchWatchlists,
  removeWatchlistItem,
} from '../../../lib/api-client';
import { chartsHref, symbolsHref } from '../../../lib/app-routes';

export default function WatchlistsPage() {
  const [watchlists, setWatchlists] = useState<WatchlistDto[]>([]);
  const [symbols, setSymbols] = useState<SymbolDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [symbolId, setSymbolId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const selected = watchlists.find((w) => w.id === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [lists, symbolRows] = await Promise.all([fetchWatchlists(), fetchSymbols()]);
        if (!cancelled) {
          setWatchlists(lists);
          setSymbols(symbolRows);
          setSelectedId(lists[0]?.id ?? null);
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

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const created = await createWatchlist(newName);
      setWatchlists((prev) => [...prev, created]);
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
      await deleteWatchlist(selected!.id);
      const deletedId = selected!.id;
      setWatchlists((prev) => {
        const next = prev.filter((w) => w.id !== deletedId);
        setSelectedId(next[0]?.id ?? null);
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '削除に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function onAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const updated = await addWatchlistItem(selected!.id, symbolId);
      setWatchlists((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '銘柄追加に失敗しました');
    } finally {
      setPending(false);
    }
  }

  async function onRemoveItem(itemId: string) {
    setError(null);
    setPending(true);
    try {
      const updated = await removeWatchlistItem(selected!.id, itemId);
      setWatchlists((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '銘柄削除に失敗しました');
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>ウォッチリスト</h1>
      <p style={leadStyle}>
        注目銘柄をリストで管理します。銘柄行からチャート分析へ進めます。
      </p>

      {loading ? <p style={{ opacity: 0.8 }}>読み込み中…</p> : null}
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
        <h2 style={sectionTitleStyle}>リスト</h2>
        <ul style={listStyle}>
          {watchlists.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => setSelectedId(w.id)}
                style={{
                  ...buttonStyle,
                  borderColor:
                    w.id === selectedId ? 'rgba(232, 238, 245, 0.9)' : 'rgba(232, 238, 245, 0.35)',
                }}
              >
                {w.name}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={onCreate} style={formRowStyle}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新しいリスト名"
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
          <h2 style={sectionTitleStyle}>{selected.name} の銘柄</h2>
          <ul style={listStyle}>
            {selected.items.map((item) => (
              <li key={item.id} style={itemRowStyle}>
                <span>
                  {item.symbol.ticker} ({item.symbol.market}) — {item.symbol.name}
                </span>
                <span style={itemActionsStyle}>
                  <Link
                    href={chartsHref({ symbolId: item.symbolId, watchlistId: selected.id })}
                    style={inlineLinkStyle}
                  >
                    チャート
                  </Link>
                  <button
                    type="button"
                    onClick={() => void onRemoveItem(item.id)}
                    disabled={pending}
                    style={buttonStyle}
                  >
                    削除
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <form onSubmit={onAddItem} style={formRowStyle}>
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
            <button type="submit" disabled={pending || symbols.length === 0} style={buttonStyle}>
              銘柄を追加
            </button>
          </form>
        </section>
      ) : null}
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
const itemActionsStyle: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'center',
};
const inlineLinkStyle: CSSProperties = {
  color: '#e8eef5',
  textDecoration: 'underline',
  fontSize: '0.95rem',
  whiteSpace: 'nowrap',
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
