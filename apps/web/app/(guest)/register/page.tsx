/**
 * ユーザー登録画面（クライアント）。
 *
 * 成功時は JWT を保存し、アプリ本体（/）へ進む。
 * ログインへのリンクだけ残し、機能メニューは出さない。
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, type CSSProperties } from 'react';
import { ApiClientError, registerUser } from '../../../lib/api-client';
import { setAccessToken } from '../../../lib/auth-token';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await registerUser({ email, password });
      setAccessToken(result.accessToken);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '登録に失敗しました');
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={pageStyle}>
      <h1 style={brandStyle}>market-platform</h1>
      <p style={leadStyle}>メールとパスワードでアカウントを作成します。</p>
      <form onSubmit={onSubmit} style={formStyle}>
        <label style={labelStyle}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Password（8文字以上）
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={inputStyle}
          />
        </label>
        {error ? <p style={errorStyle}>{error}</p> : null}
        <button type="submit" disabled={pending} style={buttonStyle}>
          {pending ? '送信中…' : '登録'}
        </button>
      </form>
      <p style={footerStyle}>
        既にアカウントがある方は <Link href="/login">ログイン</Link>
      </p>
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

const leadStyle: CSSProperties = {
  marginTop: '0.75rem',
  opacity: 0.9,
  maxWidth: '28rem',
};

const formStyle: CSSProperties = {
  marginTop: '2rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  maxWidth: '22rem',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.95rem',
};

const inputStyle: CSSProperties = {
  padding: '0.65rem 0.75rem',
  borderRadius: 0,
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0, 0, 0, 0.25)',
  color: '#e8eef5',
  font: 'inherit',
};

const buttonStyle: CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.7rem 1rem',
  border: '1px solid rgba(232, 238, 245, 0.55)',
  background: 'transparent',
  color: '#e8eef5',
  font: 'inherit',
  cursor: 'pointer',
};

const errorStyle: CSSProperties = { color: '#ffb4a8', margin: 0 };
const footerStyle: CSSProperties = { marginTop: '1.5rem', opacity: 0.85 };
