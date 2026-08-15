/**
 * ログイン後の簡易プロフィール画面。
 *
 * GET /auth/me で現在のユーザーを表示する。未ログイン誘導とログアウトは共通レイアウト側。
 */
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { AuthUser } from '@market/shared-types';
import { ApiClientError, fetchCurrentUser } from '../../../lib/api-client';

export default function MePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  return (
    <main style={pageStyle}>
      <h1 style={titleStyle}>プロフィール</h1>
      <p style={leadStyle}>ログイン中のユーザー</p>
      {error ? <p style={errorStyle}>{error}</p> : null}
      {user ? (
        <pre style={preStyle}>{JSON.stringify(user, null, 2)}</pre>
      ) : !error ? (
        <p style={{ opacity: 0.8 }}>読み込み中…</p>
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

const leadStyle: CSSProperties = { marginTop: '0.75rem', opacity: 0.9 };
const errorStyle: CSSProperties = { color: '#ffb4a8' };
const preStyle: CSSProperties = {
  marginTop: '1rem',
  padding: '1rem',
  background: 'rgba(0, 0, 0, 0.25)',
  overflow: 'auto',
};
