/**
 * バックテスト画面上部の概要帯（v0.3.0 Ph4）。
 *
 * タブを切り替えても、選択銘柄と主要指標が一目で分かるように常時表示する。
 */
'use client';

import type { CSSProperties } from 'react';
import type { BacktestSummaryDto } from '@market/shared-types';

export type BacktestOverviewStripProps = {
  /** 選択銘柄のティッカー。未選択時は null。 */
  ticker: string | null;
  /** 選択銘柄の名称（日本語名など）。空なら非表示。 */
  name: string | null;
  /** 選択中 run の期間。run 未選択時は null。 */
  fromDate: string | null;
  toDate: string | null;
  /** 選択中 run のサマリー。run 未選択時は null。 */
  summary: BacktestSummaryDto | null;
};

function pct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/** 銘柄と主要指標のコンパクト概要を描画する。 */
export function BacktestOverviewStrip({
  ticker,
  name,
  fromDate,
  toDate,
  summary,
}: BacktestOverviewStripProps) {
  const symbolLabel = ticker
    ? name
      ? `${ticker} — ${name}`
      : ticker
    : '銘柄未選択';

  return (
    <section
      data-testid="backtest-overview-strip"
      aria-label="バックテスト概要"
      style={stripStyle}
    >
      <div style={symbolStyle} data-testid="backtest-overview-symbol">
        {symbolLabel}
      </div>
      {summary && fromDate && toDate ? (
        <div style={metricsRowStyle} data-testid="backtest-overview-metrics">
          <span style={periodStyle}>
            {fromDate}〜{toDate}
          </span>
          <span>リターン {pct(summary.totalReturnRate)}</span>
          <span>勝率 {pct(summary.winRate)}</span>
          <span>最大DD {pct(summary.maxDrawdownRate)}</span>
          <span>取引数 {summary.totalTrades}</span>
        </div>
      ) : (
        <p style={emptyStyle} data-testid="backtest-overview-empty">
          実行結果がありません
        </p>
      )}
    </section>
  );
}

const stripStyle: CSSProperties = {
  marginTop: '1.25rem',
  maxWidth: '56rem',
  padding: '0.85rem 1rem',
  border: '1px solid rgba(232, 238, 245, 0.25)',
  background: 'rgba(0, 0, 0, 0.2)',
};

const symbolStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 600,
  marginBottom: '0.5rem',
};

const metricsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem 1.25rem',
  fontSize: '0.9rem',
  opacity: 0.9,
};

const periodStyle: CSSProperties = {
  opacity: 0.8,
};

const emptyStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  opacity: 0.8,
};
