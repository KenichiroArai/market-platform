/**
 * 未ログイン向けレイアウト。
 *
 * JWT が既にある場合はアプリ本体（/）へ戻し、認証画面を重ねて出さない。
 * localStorage は SSR で読めないため、判定はクライアント側のみ。
 */
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getAccessToken } from '../../lib/auth-token';

export default function GuestLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getAccessToken()) {
      router.replace('/');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return null;
  }

  return children;
}
