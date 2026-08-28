/**
 * 指標設定ウィンドウ内の保存フォーム。
 *
 * 現行のトグル集合とスコア設定を名前付きセットとして POST / PATCH する。
 * 同名が既にあれば上書き確認する。
 */
'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import {
  INDICATOR_CATALOG_BY_ID,
  type GroupWeights,
  type IndicatorCatalogId,
  type IndicatorParamOverrides,
  type IndicatorSetDto,
} from '@market/shared-types';
import { ApiClientError, createIndicatorSet, updateIndicatorSet } from '../lib/api-client';
import { isScoreConfigValid } from './indicator-score-config-form';

export type IndicatorSetSaveFormProps = {
  enabledIds: Set<IndicatorCatalogId>;
  indicatorParams: IndicatorParamOverrides;
  groupWeights: GroupWeights;
  buyThreshold: number;
  sellThreshold: number;
  draftName: string;
  onDraftNameChange: (name: string) => void;
  existingSets: IndicatorSetDto[];
  scoreConfigValid: boolean;
  /** 保存成功時。バックテストへのディープリンク用にセット ID を親へ渡す。 */
  onSaved?: (set: IndicatorSetDto) => void;
};

/** 保存対象から説明専用（disabled）の ID を除く。 */
export function idsForIndicatorSet(enabledIds: Set<IndicatorCatalogId>): IndicatorCatalogId[] {
  return [...enabledIds].filter((id) => !INDICATOR_CATALOG_BY_ID[id].disabled);
}

export function IndicatorSetSaveForm({
  enabledIds,
  indicatorParams,
  groupWeights,
  buyThreshold,
  sellThreshold,
  draftName,
  onDraftNameChange,
  existingSets,
  scoreConfigValid,
  onSaved,
}: IndicatorSetSaveFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [draftName]);

  async function saveSet(overwriteId: string | null) {
    const trimmed = draftName.trim();
    const payload = {
      name: trimmed,
      indicatorIds: idsForIndicatorSet(enabledIds),
      indicatorParams,
      groupWeights,
      buyThreshold,
      sellThreshold,
    };

    if (overwriteId) {
      return updateIndicatorSet(overwriteId, payload);
    }
    return createIndicatorSet(payload);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (trimmed.length === 0) {
      setError('セット名を入力してください');
      setSuccess(null);
      return;
    }
    if (!scoreConfigValid || !isScoreConfigValid(groupWeights, buyThreshold, sellThreshold)) {
      setError('スコア設定を修正してください（配点合計 100%、閾値の大小関係）');
      setSuccess(null);
      return;
    }

    const existing = existingSets.find((set) => set.name === trimmed);
    if (existing) {
      const ok = window.confirm(
        `「${trimmed}」は既に存在します。新しい構成で上書きしますか？`,
      );
      if (!ok) {
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await saveSet(existing?.id ?? null);
      setSuccess(existing ? '上書き保存しました' : '保存しました');
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
          value={draftName}
          onChange={(e) => onDraftNameChange(e.target.value)}
          placeholder="例: スイング"
          style={inputStyle}
          data-testid="indicator-set-name"
        />
      </label>
      <button
        type="submit"
        style={buttonStyle}
        disabled={saving || !scoreConfigValid}
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
