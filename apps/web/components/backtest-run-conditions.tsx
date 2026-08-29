/**
 * バックテスト結果タブの実行条件パネル（v0.3.0 Ph6）。
 *
 * 選択中 run のスナップショットから「何の条件でテストしたか」を示す。
 * データが無い項目は空欄。
 */
'use client';

import type { CSSProperties } from 'react';
import {
  formatStrategyLabel,
  formatTradeSidePolicyLabel,
  type FeeMode,
  type SignalStrategyParams,
  type SignalStrategyType,
  type TradeSidePolicy,
} from '@market/shared-types';

export type BacktestRunConditionsProps = {
  strategyType: SignalStrategyType | null;
  params: SignalStrategyParams | null;
  /** 指標セット名。未解決なら null（空欄）。 */
  indicatorSetName: string | null;
  fromDate: string | null;
  toDate: string | null;
  initialCash: number | null;
  feeMode?: FeeMode | null;
  feeRate: number | null;
  feeFixed?: number | null;
  slippageRate: number | null;
  tradeSidePolicy?: TradeSidePolicy | null;
  moneyManagementEnabled?: boolean | null;
};

function pctRate(rate: number | null): string {
  if (rate == null) {
    return '';
  }
  return `${(rate * 100).toFixed(2)}%`;
}

function cashLabel(value: number | null): string {
  if (value == null) {
    return '';
  }
  return value.toLocaleString('ja-JP');
}

/** 選択中 run の実行条件を表形式で描画する。 */
export function BacktestRunConditions({
  strategyType,
  params,
  indicatorSetName,
  fromDate,
  toDate,
  initialCash,
  feeMode,
  feeRate,
  feeFixed,
  slippageRate,
  tradeSidePolicy,
  moneyManagementEnabled,
}: BacktestRunConditionsProps) {
  const strategyLabel =
    strategyType && params ? formatStrategyLabel(strategyType, params) : '';
  const period =
    fromDate && toDate ? `${fromDate}〜${toDate}` : fromDate || toDate || '';
  const feeLabel =
    feeMode === 'fixed'
      ? feeFixed == null
        ? ''
        : `固定 ${feeFixed.toLocaleString('ja-JP')}`
      : pctRate(feeRate);

  return (
    <section
      data-testid="backtest-run-conditions"
      aria-label="実行条件"
      style={wrapStyle}
    >
      <h2 style={titleStyle}>実行条件</h2>
      <dl style={gridStyle}>
        <div style={rowStyle}>
          <dt style={dtStyle}>戦略</dt>
          <dd style={ddStyle} data-testid="condition-strategy">
            {strategyLabel}
          </dd>
        </div>
        <div style={rowStyle}>
          <dt style={dtStyle}>指標セット</dt>
          <dd style={ddStyle} data-testid="condition-indicator-set">
            {indicatorSetName ?? ''}
          </dd>
        </div>
        <div style={rowStyle}>
          <dt style={dtStyle}>期間</dt>
          <dd style={ddStyle} data-testid="condition-period">
            {period}
          </dd>
        </div>
        <div style={rowStyle}>
          <dt style={dtStyle}>初期資金</dt>
          <dd style={ddStyle} data-testid="condition-initial-cash">
            {cashLabel(initialCash)}
          </dd>
        </div>
        <div style={rowStyle}>
          <dt style={dtStyle}>売買方針</dt>
          <dd style={ddStyle} data-testid="condition-trade-side-policy">
            {tradeSidePolicy ? formatTradeSidePolicyLabel(tradeSidePolicy) : ''}
          </dd>
        </div>
        <div style={rowStyle}>
          <dt style={dtStyle}>手数料</dt>
          <dd style={ddStyle} data-testid="condition-fee-rate">
            {feeLabel}
          </dd>
        </div>
        <div style={rowStyle}>
          <dt style={dtStyle}>スリッページ率</dt>
          <dd style={ddStyle} data-testid="condition-slippage-rate">
            {pctRate(slippageRate)}
          </dd>
        </div>
        <div style={rowStyle}>
          <dt style={dtStyle}>資金管理</dt>
          <dd style={ddStyle} data-testid="condition-money-management">
            {moneyManagementEnabled == null ? '' : moneyManagementEnabled ? 'ON' : 'OFF'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

const wrapStyle: CSSProperties = {
  marginTop: 0,
  maxWidth: '56rem',
  padding: '0.85rem 1rem',
  border: '1px solid rgba(232, 238, 245, 0.25)',
  background: 'rgba(0, 0, 0, 0.15)',
};

const titleStyle: CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '0.95rem',
  fontWeight: 600,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))',
  gap: '0.5rem 1.25rem',
  margin: 0,
};

const rowStyle: CSSProperties = {
  margin: 0,
};

const dtStyle: CSSProperties = {
  fontSize: '0.75rem',
  opacity: 0.7,
  marginBottom: '0.15rem',
};

const ddStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  minHeight: '1.25rem',
};
