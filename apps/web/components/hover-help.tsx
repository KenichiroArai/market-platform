/**
 * ホバー／フォーカスで説明を重ねて表示する汎用ツールチップ。
 */
'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useId, useState } from 'react';

export type HoverHelpProps = {
  children: ReactNode;
  /** ツールチップ本文。 */
  text: string;
  /** ルート要素の data-testid。 */
  testId?: string;
  /** ツールチップの data-testid。 */
  tooltipTestId?: string;
};

/** 子要素にホバー／フォーカスで説明を重ねて表示する。 */
export function HoverHelp({
  children,
  text,
  testId = 'hover-help',
  tooltipTestId = 'hover-help-tooltip',
}: HoverHelpProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  return (
    <span
      style={wrapStyle}
      data-testid={testId}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      <span aria-describedby={open ? tooltipId : undefined}>{children}</span>
      {open ? (
        <span role="tooltip" id={tooltipId} data-testid={tooltipTestId} style={tooltipStyle}>
          {text}
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