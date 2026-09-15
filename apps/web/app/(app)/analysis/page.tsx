/**
 * 分析ハブ（v0.5.0 Ph2）。
 *
 * 既存のチャート分析へ誘導し、将来の分析機能枠を示す。
 */
import Link from 'next/link';

const ANALYSIS_LINKS = [
  {
    href: '/charts',
    label: 'チャート分析',
    description: 'テクニカル指標・トレンドスコア・エントリー助言',
  },
  {
    href: '/strategy',
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
