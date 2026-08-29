/**
 * フォームラベル横の ⓘ ヘルプアイコン（ホバー／フォーカスで説明表示）。
 */
'use client';

import type { CSSProperties } from 'react';
import { HoverHelp } from './hover-help';

export type FieldHelpIconProps = {
  /** ツールチップ本文。 */
  text: string;
  /** ボタンの aria-label。 */
  ariaLabel: string;
  /** ルートの data-testid（`-icon` / `-tooltip` も付与）。 */
  testId: string;
};

/** ラベル横に置く info アイコン。 */
export function FieldHelpIcon({ text, ariaLabel, testId }: FieldHelpIconProps) {
  return (
    <HoverHelp text={text} testId={testId} tooltipTestId={`${testId}-tooltip`}>
      <button
        type="button"
        aria-label={ariaLabel}
        data-testid={`${testId}-icon`}
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
