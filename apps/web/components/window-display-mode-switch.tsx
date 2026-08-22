/**
 * モードレス / 別ウィンドウの希望モード切替（ラジオ）。
 *
 * 親画面ではチャート分析共通の preferred のみ更新し、開いている表示は変えない。
 * ウィンドウ内ではその窓の ui だけ即時切替する。
 */
'use client';

import type { CSSProperties } from 'react';
import type { WindowDisplayMode } from './chart-window-state';

export type WindowDisplayModeSwitchProps = {
  /** fieldset / radio の name。画面内で一意にする。 */
  name: string;
  value: WindowDisplayMode;
  onChange: (mode: WindowDisplayMode) => void;
  /** テスト用。省略時は name から導出。 */
  testId?: string;
  legend?: string;
};

export function WindowDisplayModeSwitch({
  name,
  value,
  onChange,
  testId,
  legend = '表示',
}: WindowDisplayModeSwitchProps) {
  return (
    <fieldset style={fieldsetStyle} data-testid={testId ?? `display-mode-${name}`}>
      <legend style={legendStyle}>{legend}</legend>
      <label style={labelStyle}>
        <input
          type="radio"
          name={name}
          value="modeless"
          checked={value === 'modeless'}
          onChange={() => onChange('modeless')}
        />
        モードレス
      </label>
      <label style={labelStyle}>
        <input
          type="radio"
          name={name}
          value="popout"
          checked={value === 'popout'}
          onChange={() => onChange('popout')}
        />
        別ウィンドウ
      </label>
    </fieldset>
  );
}

const fieldsetStyle: CSSProperties = {
  margin: 0,
  padding: '0.15rem 0.5rem',
  border: '1px solid rgba(232, 238, 245, 0.35)',
  borderRadius: 4,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.5rem',
};

const legendStyle: CSSProperties = {
  padding: '0 0.25rem',
  fontSize: '0.75rem',
};

const labelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
};
