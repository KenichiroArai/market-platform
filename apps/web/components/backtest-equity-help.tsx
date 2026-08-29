/**
 * エクイティカーブ見出し用の説明ポップアップ（v0.4.0 Ph3）。
 */
'use client';

import type { CSSProperties } from 'react';
import { HoverHelp } from './hover-help';

export const EQUITY_CURVE_HELP_TEXT =
  '縦軸は資産額です。戦略はバックテストの現金＋保有評価、Buy & Hold は初日終値で全額買い・当日終値で評価した比較ラインです。';

/** 見出し右隣の info アイコン。ホバーで説明を表示する。 */
export function BacktestEquityHelp() {
  return (
    <HoverHelp
      text={EQUITY_CURVE_HELP_TEXT}
      testId="equity-curve-help"
      tooltipTestId="equity-curve-tooltip"
    >
      <button
        type="button"
        aria-label="エクイティカーブの説明"
        data-testid="equity-curve-help-icon"
        style={iconButtonStyle}
      >
        ⓘ
      </button>
    </HoverHelp>
  );
}

const iconButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 0,
  padding: '0 0.15rem',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  opacity: 0.75,
  fontSize: '0.95rem',
  lineHeight: 1,
  cursor: 'help',
};