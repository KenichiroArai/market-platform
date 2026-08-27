/**
 * バックテスト結果タブ内の「選択中の実行結果」ヘッダ（v0.3.0 Ph5）。
 *
 * 選択中 run の銘柄・期間・主要指標のみを表示する（フォーム条件とは混ぜない）。
 */
'use client';

import type { CSSProperties } from 'react';
import type { BacktestSummaryDto } from '@market/shared-types';

export type BacktestOverviewStripProps = {
  /** 選択中 run の銘柄ティッカー。未選択時は null。 */
  ticker: string | null;
  /** 選択中 run の銘柄名称。空なら非表示。 */
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

/** 選択中 run の銘柄と主要指標を描画する。 */
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
      aria-label="選択中の実行結果"
      style={stripStyle}
    >
      <p style={titleStyle} data-testid="backtest-overview-title">
        選択中の実行結果
      </p>
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
          まだ実行結果がありません
        </p>
      )}
    </section>
  );
}

const stripStyle: CSSProperties = {
  marginTop: 0,
  maxWidth: '56rem',
  padding: '0.85rem 1rem',
  border: '1px solid rgba(232, 238, 245, 0.25)',
  background: 'rgba(0, 0, 0, 0.2)',
};

const titleStyle: CSSProperties = {
  margin: '0 0 0.35rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
  opacity: 0.75,
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
