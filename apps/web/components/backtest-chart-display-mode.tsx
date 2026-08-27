/**
 * バックテスト結果チャートの表示モード切替（v0.3.0 Ph6）。
 *
 * 既定はローソク＋Buy/Sell。指標セットのオーバーレイは切替で表示する。
 */
'use client';

import type { CSSProperties } from 'react';

export type BacktestChartDisplayMode = 'base' | 'indicators';

export type BacktestChartDisplayModeSwitchProps = {
  mode: BacktestChartDisplayMode;
  onChange: (mode: BacktestChartDisplayMode) => void;
};

/** 基本＋売買 / 指標セット＋売買 のトグル。 */
export function BacktestChartDisplayModeSwitch({
  mode,
  onChange,
}: BacktestChartDisplayModeSwitchProps) {
  return (
    <div
      role="group"
      aria-label="チャート表示モード"
      data-testid="backtest-chart-display-mode"
      style={groupStyle}
    >
      <button
        type="button"
        style={mode === 'base' ? activeButtonStyle : buttonStyle}
        aria-pressed={mode === 'base'}
        data-testid="chart-mode-base"
        onClick={() => onChange('base')}
      >
        基本＋Buy/Sell
      </button>
      <button
        type="button"
        style={mode === 'indicators' ? activeButtonStyle : buttonStyle}
        aria-pressed={mode === 'indicators'}
        data-testid="chart-mode-indicators"
        onClick={() => onChange('indicators')}
      >
        指標セット＋Buy/Sell
      </button>
    </div>
  );
}

const groupStyle: CSSProperties = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  gap: '0.35rem',
};

const buttonStyle: CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.3rem 0.55rem',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(232, 238, 245, 0.35)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  opacity: 0.85,
};

const activeButtonStyle: CSSProperties = {
  ...buttonStyle,
  opacity: 1,
  background: 'rgba(232, 238, 245, 0.12)',
  borderColor: 'rgba(232, 238, 245, 0.55)',
};
