/**
 * ログイン後の簡易プロフィール画面。
 *
 * GET /auth/me で認証配線を確認する。未ログイン時は /login へ誘導する。
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import type { AuthUser } from '@market/shared-types';
import { ApiClientError, fetchCurrentUser } from '../../lib/api-client';
import { clearAccessToken, getAccessToken } from '../../lib/auth-token';

export default function MePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchCurrentUser();
        if (!cancelled) {
          setUser(me);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : '取得に失敗しました');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  function onLogout() {
    clearAccessToken();
    router.push('/login');
  }

  return (
    <main style={pageStyle}>
      <h1 style={brandStyle}>market-platform</h1>
      <p style={leadStyle}>ログイン中のユーザー</p>
      {error ? <p style={errorStyle}>{error}</p> : null}
      {user ? (
        <pre style={preStyle}>{JSON.stringify(user, null, 2)}</pre>
      ) : !error ? (
        <p style={{ opacity: 0.8 }}>読み込み中…</p>
      ) : null}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={onLogout} style={buttonStyle}>
          ログアウト
        </button>
        <Link href="/watchlists" style={{ color: '#e8eef5' }}>
          ウォッチリスト
        </Link>
        <Link href="/portfolios" style={{ color: '#e8eef5' }}>
          ポートフォリオ
        </Link>
        <Link href="/" style={{ color: '#e8eef5' }}>
          トップへ
        </Link>
      </div>
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
const errorStyle: CSSProperties = { color: '#ffb4a8' };
const preStyle: CSSProperties = {
  marginTop: '1rem',
  padding: '1rem',
  background: 'rgba(0, 0, 0, 0.25)',
  overflow: 'auto',
};
const buttonStyle: CSSProperties = {
  padding: '0.6rem 1rem',
  border: '1px solid rgba(232, 238, 245, 0.55)',
  background: 'transparent',
  color: '#e8eef5',
  font: 'inherit',
  cursor: 'pointer',
};
