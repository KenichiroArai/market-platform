/**
 * バックテスト結果サマリーカード（リターン・勝率・DD・Buy&Hold 比較・詳細統計）。
 */
'use client';

import type { CSSProperties } from 'react';
import type { BacktestSummaryDto } from '@market/shared-types';

export type BacktestSummaryCardsProps = {
  summary: BacktestSummaryDto;
};

function pct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function num(value: number, digits = 2): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

/** 主要指標をカードグリッドで表示する。 */
export function BacktestSummaryCards({ summary }: BacktestSummaryCardsProps) {
  const cards = [
    { label: '最終資産', value: num(summary.finalEquity) },
    { label: 'リターン', value: pct(summary.totalReturnRate) },
    { label: '勝率', value: pct(summary.winRate) },
    { label: '最大DD', value: pct(summary.maxDrawdownRate) },
    { label: '取引数', value: String(summary.totalTrades) },
    { label: 'Buy & Hold', value: pct(summary.buyHoldReturnRate) },
    { label: 'BH 最終資産', value: num(summary.buyHoldFinalEquity) },
    { label: 'Sharpe', value: num(summary.sharpeRatio, 3) },
    { label: 'Profit Factor', value: num(summary.profitFactor, 3) },
  ];

  const mm = summary.moneyManagement;
  if (mm) {
    const optPct = (v: number | null | undefined) =>
      v == null ? '—' : pct(v);
    const optNum = (v: number | null | undefined, d = 2) =>
      v == null ? '—' : num(v, d);
    cards.push(
      { label: '平均リスク率', value: optPct(mm.averageRiskRate) },
      { label: '最大リスク率', value: optPct(mm.maxRiskRate) },
      { label: '平均ATR', value: optNum(mm.averageAtr) },
      { label: '平均ユニット', value: optNum(mm.averageUnits, 2) },
      { label: '最大ユニット', value: optNum(mm.maxUnits, 0) },
      { label: 'ピラミッド成功率', value: optPct(mm.pyramidingSuccessRate) },
      { label: 'DD時平均リスク', value: optPct(mm.averageRiskRateInDrawdown) },
    );
  }

  return (
    <div data-testid="summary-cards" style={gridStyle}>
      {cards.map((card) => (
        <div key={card.label} style={cardStyle}>
          <div style={labelStyle}>{card.label}</div>
          <div style={valueStyle}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
  gap: '0.75rem',
  marginTop: '0.75rem',
};

const cardStyle: CSSProperties = {
  border: '1px solid rgba(232, 238, 245, 0.25)',
  padding: '0.75rem',
  background: 'rgba(0, 0, 0, 0.2)',
};

const labelStyle: CSSProperties = {
  fontSize: '0.8rem',
  opacity: 0.75,
  marginBottom: '0.35rem',
};

const valueStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 600,
};
