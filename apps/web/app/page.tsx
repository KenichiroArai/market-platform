/**
 * トップページ（Phase 1）。
 *
 * プロダクト名をヒーロー級で示し、API ヘルスと認証導線を表示する。
 */
import Link from 'next/link';
import { fetchApiHealth } from '../lib/fetch-api-health';

export default async function HomePage() {
  // サーバー側で取得。失敗してもページ全体は 200 で返す
  const health = await fetchApiHealth();

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '3rem 1.5rem',
        // フラット単色を避け、第一画面にわずかな奥行きを出す
        background: 'linear-gradient(160deg, #0f1c2e 0%, #1a334d 45%, #243b55 100%)',
        color: '#e8eef5',
      }}
    >
      <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', margin: 0, letterSpacing: '-0.03em' }}>
        market-platform
      </h1>
      <p style={{ marginTop: '1rem', maxWidth: '36rem', lineHeight: 1.6, opacity: 0.9 }}>
        株式・ETF・指数などの市場データと分析基盤のモノレポです。Phase 3 ではウォッチリストとポートフォリオを提供します。
      </p>
      <p style={{ marginTop: '1.25rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
        <Link href="/login" style={{ color: '#e8eef5' }}>
          ログイン
        </Link>
        <Link href="/register" style={{ color: '#e8eef5' }}>
          登録
        </Link>
        <Link href="/watchlists" style={{ color: '#e8eef5' }}>
          ウォッチリスト
        </Link>
        <Link href="/portfolios" style={{ color: '#e8eef5' }}>
          ポートフォリオ
        </Link>
        <Link href="/backtests" style={{ color: '#e8eef5' }}>
          Signals / Backtest
        </Link>
      </p>
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
