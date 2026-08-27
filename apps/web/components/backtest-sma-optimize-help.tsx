/**
 * SMA 最適化ボタン向けのホバー／フォーカス説明ポップアップ（v0.3.0 Ph5）。
 */
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useId, useState } from 'react';

export const SMA_OPTIMIZE_HELP_TEXT =
  'カタログの SMA ペア（例: 25/75、25/200、75/200）を同じ銘柄・期間・資金で比較します。結果は永続化されません。適用する場合はチャート分析で該当 SMA を 2 本選んで指標セットを保存してください。';

export type BacktestSmaOptimizeHelpProps = {
  children: ReactNode;
};

/** 子要素にホバー／フォーカスで説明を重ねて表示する。 */
export function BacktestSmaOptimizeHelp({ children }: BacktestSmaOptimizeHelpProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      style={wrapStyle}
      data-testid="sma-optimize-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      <span aria-describedby={open ? tooltipId : undefined}>{children}</span>
      {open ? (
        <span
          role="tooltip"
          id={tooltipId}
          data-testid="sma-optimize-tooltip"
          style={tooltipStyle}
        >
          {SMA_OPTIMIZE_HELP_TEXT}
        </span>
      ) : null}
    </span>
  );
}

const wrapStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
};

const tooltipStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  bottom: 'calc(100% + 0.4rem)',
  zIndex: 20,
  width: 'min(22rem, 70vw)',
  padding: '0.65rem 0.75rem',
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: '#1a334d',
  color: '#e8eef5',
  fontSize: '0.85rem',
  lineHeight: 1.5,
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
};
