/**
 * ログイン後アプリの共通シェル。
 *
 * トークンが無い／無効なら /login へ戻し、本体は出さない（チラつき防止）。
 * 有効ならヘッダー（メニュー + ログアウト）を付けて各ページを表示する。
 */
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AppHeader } from '../../components/app-header';
import { fetchCurrentUser } from '../../lib/api-client';
import { clearAccessToken, getAccessToken } from '../../lib/auth-token';

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await fetchCurrentUser();
        if (!cancelled) {
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          clearAccessToken();
          router.replace('/login');
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

  if (!ready) {
    return (
      <div style={shellStyle}>
        <p style={loadingStyle}>読み込み中…</p>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <AppHeader onLogout={onLogout} />
      {children}
    </div>
  );
}

const shellStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(160deg, #0f1c2e 0%, #1a334d 45%, #243b55 100%)',
  color: '#e8eef5',
};

const loadingStyle: CSSProperties = {
  margin: 0,
  padding: '2rem 1.5rem',
  opacity: 0.8,
};
