/**
 * トップページ（ログイン後）。
 *
 * 各機能への入口と API ヘルスを示す。
 */
import Link from 'next/link';
import { fetchApiHealth } from '../../lib/fetch-api-health';

const FEATURE_LINKS = [
  { href: '/symbols', label: '銘柄' },
  { href: '/watchlists', label: 'ウォッチリスト' },
  { href: '/portfolios', label: 'ポートフォリオ' },
  { href: '/backtests', label: 'シグナル / バックテスト' },
  { href: '/charts', label: 'チャート分析' },
] as const;

export default async function HomePage() {
  // サーバー側で取得。失敗してもページ全体は 200 で返す
  const health = await fetchApiHealth();

  return (
    <main style={{ padding: '2rem 1.5rem' }}>
      <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', margin: 0, letterSpacing: '-0.03em' }}>
        market-platform
      </h1>
      <p style={{ marginTop: '0.75rem', maxWidth: '40rem', lineHeight: 1.6, opacity: 0.85 }}>
        各機能への入口です。銘柄の登録からチャート分析・シグナル検証まで進めます。下に API
        の稼働状態を表示します。
      </p>
      <nav
        aria-label="主要機能"
        style={{
          marginTop: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem 1.1rem',
        }}
      >
        {FEATURE_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{ color: '#e8eef5', textDecoration: 'underline', fontSize: '0.95rem' }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <section style={{ marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>API health</h2>
        {health ? (
          <pre
            style={{
              marginTop: '0.75rem',
              padding: '1rem',
              background: 'rgba(0, 0, 0, 0.25)',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(health, null, 2)}
          </pre>
        ) : (
          <p style={{ marginTop: '0.75rem', opacity: 0.8 }}>
            {/* 接続先を明示し、ローカル / Docker の設定ミス切り分けを助ける */}
            API に接続できませんでした（{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}
            ）。
          </p>
        )}
      </section>
    </main>
  );
}
