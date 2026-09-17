/**
 * 分析ハブ（v0.5.0 Ph2 / Ph3）。
 *
 * チャート・戦略・検証結果からの見直し導線を集約する。
 */
import Link from 'next/link';
import { backtestsHref, chartsHref, strategyHref } from '../../../lib/app-routes';

const ANALYSIS_LINKS = [
  {
    href: chartsHref(),
    label: 'チャート分析',
    description: 'テクニカル指標・トレンドスコア・エントリー助言',
  },
  {
    href: strategyHref(),
    label: '戦略（トレードプラン）',
    description: '売買判定・損切／利確・ポジションサイズ',
  },
] as const;

const FUTURE = [
  'テクニカル分析（詳細）',
  'トレンド分析',
  'ファンダメンタル分析',
] as const;

export default function AnalysisHubPage() {
  return (
    <main style={{ padding: '2rem 1.5rem', maxWidth: '42rem' }}>
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>分析</h1>
      <p style={{ marginTop: '0.75rem', lineHeight: 1.6, opacity: 0.85 }}>
        チャートや指標による分析機能を集約しています。売買判断・資金管理は「戦略」へ進んでください。
      </p>
      <nav aria-label="分析メニュー" style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
        {ANALYSIS_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              padding: '1rem 1.1rem',
              border: '1px solid rgba(232, 238, 245, 0.25)',
              color: '#e8eef5',
              textDecoration: 'none',
            }}
          >
            <strong style={{ fontSize: '1.05rem' }}>{item.label}</strong>
            <span style={{ display: 'block', marginTop: '0.35rem', opacity: 0.75, fontSize: '0.9rem' }}>
              {item.description}
            </span>
          </Link>
        ))}
      </nav>

      <section
        style={{
          marginTop: '1.75rem',
          padding: '1rem 1.1rem',
          border: '1px solid rgba(232, 238, 245, 0.25)',
          background: 'rgba(0, 0, 0, 0.15)',
        }}
        aria-label="検証結果から見直す"
      >
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>検証結果から見直す</h2>
        <p style={{ marginTop: '0.5rem', lineHeight: 1.6, opacity: 0.8, fontSize: '0.9rem' }}>
          バックテスト結果の「結果の読み取り」から、ルールベースの所見と再実行プリセット、戦略／チャートへの導線で次の一手につなげます。
        </p>
        <Link
          href={backtestsHref()}
          style={{
            display: 'inline-block',
            marginTop: '0.75rem',
            color: '#e8eef5',
            textDecoration: 'underline',
          }}
          data-testid="analysis-hub-backtests-link"
        >
          バックテストを開く
        </Link>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, opacity: 0.7 }}>今後追加予定</h2>
        <ul style={{ marginTop: '0.5rem', opacity: 0.55, lineHeight: 1.7 }}>
          {FUTURE.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
