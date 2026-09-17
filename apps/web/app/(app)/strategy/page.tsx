/**
 * 戦略（トレードプラン）画面 — ADR 018 / v0.5.0 Phase 2–3。
 *
 * 銘柄を選び、判定・Entry/Stop/Target・RR・株数・リスク・理由を一画面で表示する。
 * クエリ（symbolId / from / to / stopMethod 等）から初期値を引き継げる。
 */
'use client';

import {
  JUDGMENT_LEVEL_LABELS,
  RISK_LEVEL_LABELS,
  STOP_LOSS_METHOD_LABELS,
  TAKE_PROFIT_METHOD_LABELS,
  type StopLossMethod,
  type TakeProfitMethod,
  type TradePlanDto,
} from '@market/shared-types';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AnalysisWorkflowBar } from '../../../components/analysis-workflow-bar';
import { ApiClientError, fetchSymbols, fetchTradePlan } from '../../../lib/api-client';
import { defaultChartFromDate, defaultChartToDate } from '../../../lib/chart-date-range';

function stars(n: number): string {
  return '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n));
}

function formatPrice(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function isStopMethod(value: string): value is StopLossMethod {
  return value in STOP_LOSS_METHOD_LABELS;
}

function isTakeProfitMethod(value: string): value is TakeProfitMethod {
  return value in TAKE_PROFIT_METHOD_LABELS;
}

function StrategyPageContent() {
  const searchParams = useSearchParams();
  const [symbols, setSymbols] = useState<Array<{ id: string; ticker: string; name: string }>>([]);
  const [symbolId, setSymbolId] = useState('');
  const [from, setFrom] = useState(() => searchParams.get('from') ?? defaultChartFromDate());
  const [to, setTo] = useState(() => searchParams.get('to') ?? defaultChartToDate());
  const [equity, setEquity] = useState(() => searchParams.get('equity') ?? '1000000');
  const [riskRate, setRiskRate] = useState(() => searchParams.get('riskRate') ?? '0.01');
  const [stopMethod, setStopMethod] = useState<StopLossMethod | ''>(() => {
    const q = searchParams.get('stopMethod');
    return q && isStopMethod(q) ? q : '';
  });
  const [takeProfitMethod, setTakeProfitMethod] = useState<TakeProfitMethod | ''>(() => {
    const q = searchParams.get('takeProfitMethod');
    return q && isTakeProfitMethod(q) ? q : 'rr_target';
  });
  const [plan, setPlan] = useState<TradePlanDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchSymbols();
        if (cancelled) return;
        setSymbols(list.map((s) => ({ id: s.id, ticker: s.ticker, name: s.name })));
        const querySymbol = searchParams.get('symbolId');
        if (querySymbol && list.some((s) => s.id === querySymbol)) {
          setSymbolId(querySymbol);
        } else if (list[0]) {
          setSymbolId(list[0].id);
        }
        const queryFrom = searchParams.get('from');
        const queryTo = searchParams.get('to');
        if (queryFrom) setFrom(queryFrom);
        if (queryTo) setTo(queryTo);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiClientError ? e.message : '銘柄の取得に失敗しました');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const equityNum = Number(equity);
      const riskNum = Number(riskRate);
      const result = await fetchTradePlan(symbolId, {
        equity: equityNum,
        riskRate: riskNum,
        ...(stopMethod ? { stopMethod } : {}),
        ...(takeProfitMethod ? { takeProfitMethod } : {}),
      });
      setPlan(result);
    } catch (e) {
      setPlan(null);
      setError(e instanceof ApiClientError ? e.message : 'トレードプランの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [symbolId, equity, riskRate, stopMethod, takeProfitMethod]);

  const equityNum = Number(equity);
  const riskNum = Number(riskRate);
  const workflowContext = {
    symbolId,
    from,
    to,
    stopMethod: stopMethod || null,
    takeProfitMethod: takeProfitMethod || null,
    equity: equityNum,
    riskRate: riskNum,
  };

  return (
    <main style={{ padding: '2rem 1.5rem', maxWidth: '52rem' }}>
      <AnalysisWorkflowBar current="strategy" context={workflowContext} />
      <h1 style={{ fontSize: '1.75rem', margin: 0 }}>戦略</h1>
      <p style={{ marginTop: '0.75rem', lineHeight: 1.6, opacity: 0.85 }}>
        分析結果から売買判定・損切／利確・資金管理までを一画面のトレードプランとして提示します。
        上のバーからチャート・バックテスト・分析ハブへコンテキスト付きで進めます。
      </p>

      <section style={formStyle} aria-label="トレードプラン条件">
        <label style={labelStyle}>
          銘柄
          <select
            value={symbolId}
            onChange={(e) => setSymbolId(e.target.value)}
            style={inputStyle}
            data-testid="strategy-symbol"
          >
            {symbols.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ticker} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          総資産
          <input
            type="number"
            value={equity}
            onChange={(e) => setEquity(e.target.value)}
            style={inputStyle}
            data-testid="strategy-equity"
          />
        </label>
        <label style={labelStyle}>
          許容損失率
          <input
            type="number"
            step="0.001"
            value={riskRate}
            onChange={(e) => setRiskRate(e.target.value)}
            style={inputStyle}
            data-testid="strategy-risk-rate"
          />
        </label>
        <label style={labelStyle}>
          損切方式（任意）
          <select
            value={stopMethod}
            onChange={(e) => setStopMethod(e.target.value as StopLossMethod | '')}
            style={inputStyle}
            data-testid="strategy-stop-method"
          >
            <option value="">自動推奨</option>
            {(Object.keys(STOP_LOSS_METHOD_LABELS) as StopLossMethod[]).map((k) => (
              <option key={k} value={k}>
                {STOP_LOSS_METHOD_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          利確方式
          <select
            value={takeProfitMethod}
            onChange={(e) => setTakeProfitMethod(e.target.value as TakeProfitMethod | '')}
            style={inputStyle}
            data-testid="strategy-take-profit-method"
          >
            <option value="">自動推奨</option>
            {(Object.keys(TAKE_PROFIT_METHOD_LABELS) as TakeProfitMethod[]).map((k) => (
              <option key={k} value={k}>
                {TAKE_PROFIT_METHOD_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void loadPlan()} style={buttonStyle} disabled={loading || !symbolId}>
          {loading ? '計算中…' : 'トレードプランを表示'}
        </button>
      </section>

      {error ? (
        <p style={{ color: '#ef9a9a' }} data-testid="strategy-error">
          {error}
        </p>
      ) : null}

      {plan ? <TradePlanView plan={plan} /> : null}
    </main>
  );
}

function TradePlanView({ plan }: { plan: TradePlanDto }) {
  return (
    <section style={planStyle} data-testid="trade-plan" aria-label="トレードプラン結果">
      <header style={{ marginBottom: '1.25rem' }}>
        <p style={eyebrowStyle}>{plan.baseDate}</p>
        <h2 style={{ margin: '0.25rem 0', fontSize: '1.5rem' }}>{plan.summaryLabel}</h2>
        <p style={{ margin: 0, fontSize: '1.25rem' }} data-testid="trade-plan-judgment">
          {JUDGMENT_LEVEL_LABELS[plan.judgment.level]} {stars(plan.judgment.stars)}（
          {plan.judgment.score} / 100）
        </p>
        <p style={{ margin: '0.35rem 0 0', opacity: 0.8 }}>総合評価 {plan.overallScore} 点</p>
      </header>

      <dl style={gridStyle}>
        <div>
          <dt>現在価格</dt>
          <dd>{formatPrice(plan.entry.currentPrice)}</dd>
        </div>
        <div>
          <dt>推奨エントリー</dt>
          <dd data-testid="trade-plan-entry">
            {formatPrice(plan.entry.recommendedPrice)}（{plan.entry.side === 'long' ? '買い' : '売り'}）
          </dd>
        </div>
        <div>
          <dt>損切</dt>
          <dd data-testid="trade-plan-stop">
            {plan.recommendedStop ? formatPrice(plan.recommendedStop.price) : '—'}
          </dd>
        </div>
        <div>
          <dt>利確</dt>
          <dd data-testid="trade-plan-target">
            {plan.recommendedTarget ? formatPrice(plan.recommendedTarget.price) : '—'}
          </dd>
        </div>
        <div>
          <dt>RR</dt>
          <dd data-testid="trade-plan-rr">
            {plan.riskReward ? plan.riskReward.riskReward.toFixed(2) : '—'}
          </dd>
        </div>
        <div>
          <dt>推奨株数</dt>
          <dd data-testid="trade-plan-shares">
            {plan.position ? plan.position.recommendedShares.toLocaleString() : '—'}
          </dd>
        </div>
        <div>
          <dt>最大損失</dt>
          <dd>{plan.position ? formatPrice(plan.position.maxLoss) : '—'}</dd>
        </div>
        <div>
          <dt>リスク</dt>
          <dd>
            {RISK_LEVEL_LABELS[plan.riskRating.level]} {stars(plan.riskRating.stars)}
          </dd>
        </div>
      </dl>

      <p style={{ marginTop: '1rem', opacity: 0.85, lineHeight: 1.5 }}>{plan.entry.rationale}</p>

      <div style={twoColStyle}>
        <div>
          <h3 style={h3Style}>損切候補</h3>
          <ul style={listStyle}>
            {plan.stopLossCandidates.map((c) => (
              <li key={c.method}>
                {c.recommended ? '● ' : ''}
                {c.label}: {formatPrice(c.price)} — {c.rationale}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 style={h3Style}>利確候補</h3>
          <ul style={listStyle}>
            {plan.takeProfitCandidates.map((c) => (
              <li key={c.method}>
                {c.recommended ? '● ' : ''}
                {c.label}: {formatPrice(c.price)} — {c.rationale}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={twoColStyle}>
        <div>
          <h3 style={h3Style}>買い理由</h3>
          <ul style={listStyle} data-testid="trade-plan-buy-reasons">
            {plan.buyReasons.length === 0 ? <li>（なし）</li> : null}
            {plan.buyReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 style={h3Style}>売り理由</h3>
          <ul style={listStyle} data-testid="trade-plan-sell-reasons">
            {plan.sellReasons.length === 0 ? <li>（なし）</li> : null}
            {plan.sellReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 style={h3Style}>リスク評価メモ</h3>
        <ul style={listStyle}>
          {plan.riskRating.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** useSearchParams 用の Suspense 境界。 */
export default function StrategyPage() {
  return (
    <Suspense fallback={<main style={{ padding: '2rem 1.5rem' }}>読み込み中…</main>}>
      <StrategyPageContent />
    </Suspense>
  );
}

const formStyle: CSSProperties = {
  marginTop: '1.5rem',
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))',
  alignItems: 'end',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.85rem',
};

const inputStyle: CSSProperties = {
  padding: '0.45rem 0.55rem',
  background: 'rgba(0,0,0,0.25)',
  border: '1px solid rgba(232,238,245,0.35)',
  color: '#e8eef5',
};

const buttonStyle: CSSProperties = {
  padding: '0.55rem 1rem',
  border: '1px solid rgba(232,238,245,0.55)',
  background: 'transparent',
  color: '#e8eef5',
  cursor: 'pointer',
};

const planStyle: CSSProperties = {
  marginTop: '2rem',
  padding: '1.25rem 1.35rem',
  border: '1px solid rgba(232,238,245,0.2)',
};

const eyebrowStyle: CSSProperties = { margin: 0, opacity: 0.6, fontSize: '0.85rem' };

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))',
  gap: '0.85rem 1.25rem',
  margin: 0,
};

const twoColStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1.25rem',
  marginTop: '1.25rem',
};

const h3Style: CSSProperties = { fontSize: '0.95rem', margin: '0 0 0.4rem' };
const listStyle: CSSProperties = { margin: 0, paddingLeft: '1.1rem', lineHeight: 1.55, fontSize: '0.9rem' };
