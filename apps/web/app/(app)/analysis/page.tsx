/**
 * 分析ハブ（v0.5.0 Ph2 / Ph3）。
 *
 * 銘柄・期間の共通コンテキストを持ち、チャート→戦略→バックテストへ
 * URL クエリで引き継ぐ司令塔。巨大画面統合はしない。
 */
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ApiClientError, fetchSymbols } from '../../../lib/api-client';
import {
  analysisHref,
  backtestsHref,
  chartsHref,
  strategyHref,
} from '../../../lib/app-routes';
import { defaultChartFromDate, defaultChartToDate } from '../../../lib/chart-date-range';

const FUTURE = [
  'テクニカル分析（詳細）',
  'トレンド分析',
  'ファンダメンタル分析',
] as const;

type SymbolOption = { id: string; ticker: string; name: string };

function AnalysisHubContent() {
  const searchParams = useSearchParams();
  const [symbols, setSymbols] = useState<SymbolOption[]>([]);
  const [symbolId, setSymbolId] = useState('');
  const [from, setFrom] = useState(() => searchParams.get('from') ?? defaultChartFromDate());
  const [to, setTo] = useState(() => searchParams.get('to') ?? defaultChartToDate());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchSymbols();
        if (cancelled) return;
        const options = list.map((s) => ({ id: s.id, ticker: s.ticker, name: s.name }));
        setSymbols(options);
        const querySymbol = searchParams.get('symbolId');
        if (querySymbol && options.some((s) => s.id === querySymbol)) {
          setSymbolId(querySymbol);
        } else if (options[0]) {
          setSymbolId(options[0].id);
        }
        const queryFrom = searchParams.get('from');
        const queryTo = searchParams.get('to');
        if (queryFrom) setFrom(queryFrom);
        if (queryTo) setTo(queryTo);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiClientError ? e.message : '銘柄の取得に失敗しました');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const selected = useMemo(
    () => symbols.find((s) => s.id === symbolId) ?? null,
    [symbols, symbolId],
  );

  const ctx = { symbolId, from, to };

  const chartsLink = chartsHref(ctx);
  const strategyLink = strategyHref(ctx);
  const backtestsLink = backtestsHref(ctx);

  /** 銘柄・期間を変えたとき、URL も揃えてブックマーク可能にする。 */
  function syncUrl(next: { symbolId?: string; from?: string; to?: string }) {
    const href = analysisHref({
      symbolId: next.symbolId ?? ctx.symbolId,
      from: next.from ?? ctx.from,
      to: next.to ?? ctx.to,
    });
    window.history.replaceState(null, '', href);
  }

  return (
    <main style={{ padding: '2rem 1.5rem', maxWidth: '42rem' }}>
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>分析</h1>
      <p style={{ marginTop: '0.75rem', lineHeight: 1.6, opacity: 0.85 }}>
        チャート・戦略・バックテストを同じ銘柄・期間でつなぎます。各画面から「分析に戻る」か「次へ」で進めます。
      </p>

      <section
        style={contextSectionStyle}
        aria-label="作業コンテキスト"
        data-testid="analysis-hub-context"
      >
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>作業コンテキスト</h2>
        <p style={{ marginTop: '0.45rem', fontSize: '0.9rem', opacity: 0.8, lineHeight: 1.5 }}>
          ここで選んだ銘柄と期間は、チャート・戦略・バックテストへ引き継がれます。
        </p>
        {error ? (
          <p data-testid="analysis-hub-error" style={{ color: '#f5a8a8', marginTop: '0.75rem' }}>
            {error}
          </p>
        ) : null}
        {loading ? <p style={{ marginTop: '0.75rem', opacity: 0.75 }}>読み込み中…</p> : null}
        {!loading ? (
          <div style={formRowStyle}>
            <label style={labelStyle}>
              銘柄
              <select
                value={symbolId}
                onChange={(e) => {
                  const next = e.target.value;
                  setSymbolId(next);
                  syncUrl({ symbolId: next });
                }}
                style={inputStyle}
                data-testid="analysis-hub-symbol"
              >
                {symbols.length === 0 ? (
                  <option value="">銘柄なし</option>
                ) : (
                  symbols.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ticker} — {s.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label style={labelStyle}>
              From
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  syncUrl({ from: e.target.value });
                }}
                style={inputStyle}
                data-testid="analysis-hub-from"
              />
            </label>
            <label style={labelStyle}>
              To
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  syncUrl({ to: e.target.value });
                }}
                style={inputStyle}
                data-testid="analysis-hub-to"
              />
            </label>
          </div>
        ) : null}
        {selected ? (
          <p data-testid="analysis-hub-summary" style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
            いまの作業: {selected.ticker}（{from} 〜 {to}）
          </p>
        ) : null}
      </section>

      <section style={{ marginTop: '1.5rem' }} aria-label="推奨フロー">
        <h2 style={{ fontSize: '1.05rem', margin: 0 }}>推奨フロー</h2>
        <p style={{ marginTop: '0.45rem', fontSize: '0.9rem', opacity: 0.8, lineHeight: 1.5 }}>
          チャート分析 → 戦略（トレードプラン） → バックテスト の順で進めると、設定が途切れにくくなります。
        </p>
        <ol style={flowListStyle} data-testid="analysis-hub-flow">
          <li>チャートで銘柄・指標・期間を確認</li>
          <li>戦略で損切／利確・資金管理を決める</li>
          <li>バックテストで検証し、結果の読み取りから見直す</li>
        </ol>
      </section>

      <nav aria-label="分析メニュー" style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
        <Link href={chartsLink} style={cardLinkStyle} data-testid="analysis-hub-charts-link">
          <strong style={{ fontSize: '1.05rem' }}>1. チャート分析</strong>
          <span style={cardDescStyle}>テクニカル指標・トレンドスコア・エントリー助言</span>
        </Link>
        <Link href={strategyLink} style={cardLinkStyle} data-testid="analysis-hub-strategy-link">
          <strong style={{ fontSize: '1.05rem' }}>2. 戦略（トレードプラン）</strong>
          <span style={cardDescStyle}>売買判定・損切／利確・ポジションサイズ</span>
        </Link>
        <Link href={backtestsLink} style={cardLinkStyle} data-testid="analysis-hub-backtests-flow-link">
          <strong style={{ fontSize: '1.05rem' }}>3. バックテスト</strong>
          <span style={cardDescStyle}>条件を検証し、結果の読み取りで次の一手へ</span>
        </Link>
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
          href={backtestsLink}
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

/** useSearchParams 用の Suspense 境界。 */
export default function AnalysisHubPage() {
  return (
    <Suspense fallback={<main style={{ padding: '2rem 1.5rem' }}>読み込み中…</main>}>
      <AnalysisHubContent />
    </Suspense>
  );
}

const contextSectionStyle: CSSProperties = {
  marginTop: '1.5rem',
  padding: '1rem 1.1rem',
  border: '1px solid rgba(232, 238, 245, 0.25)',
  background: 'rgba(0, 0, 0, 0.12)',
};

const formRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))',
  gap: '0.85rem 1rem',
  marginTop: '0.85rem',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.85rem',
};

const inputStyle: CSSProperties = {
  padding: '0.4rem 0.5rem',
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(232,238,245,0.35)',
  color: '#e8eef5',
};

const flowListStyle: CSSProperties = {
  margin: '0.5rem 0 0',
  paddingLeft: '1.25rem',
  lineHeight: 1.7,
  fontSize: '0.9rem',
  opacity: 0.85,
};

const cardLinkStyle: CSSProperties = {
  display: 'block',
  padding: '1rem 1.1rem',
  border: '1px solid rgba(232, 238, 245, 0.25)',
  color: '#e8eef5',
  textDecoration: 'none',
};

const cardDescStyle: CSSProperties = {
  display: 'block',
  marginTop: '0.35rem',
  opacity: 0.75,
  fontSize: '0.9rem',
};
