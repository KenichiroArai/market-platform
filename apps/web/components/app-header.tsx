/**
 * ログイン後の共通ヘッダー。
 *
 * 機能画面へのメニューとログアウトだけを置く。
 * ログイン／登録へのリンクは出さない（未ログイン時は認証画面へ誘導するため不要）。
 */
'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';

/** ヘッダーに出す機能メニュー。URL はルートグループを使っても変わらない。 */
export const APP_NAV_ITEMS = [
  { href: '/', label: 'トップ' },
  { href: '/symbols', label: '銘柄' },
  { href: '/watchlists', label: 'ウォッチリスト' },
  { href: '/portfolios', label: 'ポートフォリオ' },
  { href: '/backtests', label: 'シグナル / バックテスト' },
  { href: '/charts', label: 'チャート分析' },
  { href: '/me', label: 'プロフィール' },
] as const;

export type AppHeaderProps = {
  /** トークン削除と /login への遷移は呼び出し側（レイアウト）が行う。 */
  onLogout: () => void;
};

export function AppHeader({ onLogout }: AppHeaderProps) {
  return (
    <header style={headerStyle}>
      <Link href="/" style={brandStyle}>
        market-platform
      </Link>
      <nav style={navStyle} aria-label="メインメニュー">
        {APP_NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} style={linkStyle}>
            {item.label}
          </Link>
        ))}
        <button type="button" onClick={onLogout} style={buttonStyle}>
          ログアウト
        </button>
      </nav>
    </header>
  );
}

const headerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem 1.5rem',
  padding: '0.9rem 1.5rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.2)',
};

const brandStyle: CSSProperties = {
  color: '#e8eef5',
  textDecoration: 'none',
  fontSize: '1.15rem',
  letterSpacing: '-0.03em',
};

const navStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.85rem 1.1rem',
};

const linkStyle: CSSProperties = {
  color: '#e8eef5',
  textDecoration: 'none',
  fontSize: '0.95rem',
};

const buttonStyle: CSSProperties = {
  padding: '0.4rem 0.85rem',
  border: '1px solid rgba(232, 238, 245, 0.55)',
  background: 'transparent',
  color: '#e8eef5',
  font: 'inherit',
  cursor: 'pointer',
};
