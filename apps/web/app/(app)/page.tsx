/**
 * トップページ（ログイン後）。
 *
 * プロダクト名と API ヘルスを示す。機能への導線は共通ヘッダーに集約する。
 */
import { fetchApiHealth } from '../../lib/fetch-api-health';

export default async function HomePage() {
  // サーバー側で取得。失敗してもページ全体は 200 で返す
  const health = await fetchApiHealth();

  return (
    <main style={{ padding: '2rem 1.5rem' }}>
      <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', margin: 0, letterSpacing: '-0.03em' }}>
        market-platform
      </h1>
      <p style={{ marginTop: '1rem', maxWidth: '36rem', lineHeight: 1.6, opacity: 0.9 }}>
        株式・ETF・指数などの市場データと分析基盤のモノレポです。チャート分析ではローソク足とテクニカル指標を一体で確認できます。
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
