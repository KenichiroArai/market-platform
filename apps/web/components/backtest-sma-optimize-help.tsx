/**
 * SMA 最適化ボタン向けのホバー／フォーカス説明ポップアップ（v0.3.0 Ph5）。
 */
'use client';

import type { ReactNode } from 'react';
import { HoverHelp } from './hover-help';

export const SMA_OPTIMIZE_HELP_TEXT =
  'カタログの SMA ペア（例: 25/75、25/200、75/200）を同じ銘柄・期間・資金で比較します。結果は永続化されません。適用する場合はチャート分析で該当 SMA を 2 本選んで指標セットを保存してください。';

export type BacktestSmaOptimizeHelpProps = {
  children: ReactNode;
};

/** 子要素にホバー／フォーカスで説明を重ねて表示する。 */
export function BacktestSmaOptimizeHelp({ children }: BacktestSmaOptimizeHelpProps) {
  return (
    <HoverHelp
      text={SMA_OPTIMIZE_HELP_TEXT}
      testId="sma-optimize-help"
      tooltipTestId="sma-optimize-tooltip"
    >
      {children}
    </HoverHelp>
  );
}
