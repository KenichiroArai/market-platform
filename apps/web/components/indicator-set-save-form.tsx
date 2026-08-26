/**
 * 指標設定ウィンドウ内の保存フォーム。
 *
 * 現行のトグル集合を名前付きセットとして POST する。
 * 呼び出し UI は別ウィンドウ側に置く。
 */
'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';
import {
  INDICATOR_CATALOG_BY_ID,
  type IndicatorCatalogId,
  type IndicatorSetDto,
} from '@market/shared-types';
import { ApiClientError, createIndicatorSet } from '../lib/api-client';

export type IndicatorSetSaveFormProps = {
  enabledIds: Set<IndicatorCatalogId>;
  /** 保存成功時。バックテストへのディープリンク用にセット ID を親へ渡す。 */
  onSaved?: (set: IndicatorSetDto) => void;
};

/** 保存対象から説明専用（disabled）の ID を除く。 */
export function idsForIndicatorSet(enabledIds: Set<IndicatorCatalogId>): IndicatorCatalogId[] {
  return [...enabledIds].filter((id) => !INDICATOR_CATALOG_BY_ID[id].disabled);
}

export function IndicatorSetSaveForm({ enabledIds, onSaved }: IndicatorSetSaveFormProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('セット名を入力してください');
      setSuccess(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await createIndicatorSet(trimmed, idsForIndicatorSet(enabledIds));
      setName('');
      setSuccess('保存しました');
      onSaved?.(created);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form style={formStyle} onSubmit={(event) => void onSubmit(event)} data-testid="indicator-set-save">
      <label style={labelStyle}>
        セット名
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: スイング"
          style={inputStyle}
          data-testid="indicator-set-name"
        />
      </label>
      <button
        type="submit"
        style={buttonStyle}
        disabled={saving}
        data-testid="indicator-set-save-button"
      >
        {saving ? '保存中…' : 'この指定を保存'}
      </button>
      {error ? (
        <p style={errorStyle} data-testid="indicator-set-save-error">
          {error}
        </p>
      ) : null}
      {success ? (
        <p style={successStyle} data-testid="indicator-set-save-success">
          {success}
        </p>
      ) : null}
    </form>
  );
}

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  border: '1px solid rgba(232, 238, 245, 0.2)',
  borderRadius: 4,
  padding: '0.6rem',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  fontSize: '0.85rem',
};

const inputStyle: CSSProperties = {
  padding: '0.35rem 0.5rem',
  borderRadius: 4,
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef5',
};

const buttonStyle: CSSProperties = {
  padding: '0.35rem 0.6rem',
  borderRadius: 4,
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef5',
  cursor: 'pointer',
  fontSize: '0.85rem',
};

const errorStyle: CSSProperties = {
  margin: 0,
  color: '#ffb4b4',
  fontSize: '0.8rem',
};

const successStyle: CSSProperties = {
  margin: 0,
  color: '#b4e0b4',
  fontSize: '0.8rem',
};
