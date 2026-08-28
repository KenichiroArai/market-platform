/**
 * 指標パラメータ編集（ADR 014）。
 *
 * ON の指標についてカタログ定義キーを数値入力する。
 */
'use client';

import { useMemo, type CSSProperties } from 'react';
import {
  INDICATOR_CATALOG_BY_ID,
  editableParamKeys,
  type IndicatorCatalogId,
  type IndicatorParamOverrides,
} from '@market/shared-types';

export type IndicatorParamEditorProps = {
  enabledIds: Set<IndicatorCatalogId>;
  params: IndicatorParamOverrides;
  onChange: (next: IndicatorParamOverrides) => void;
};

/** パラメータ変更を適用する。未知キーは null。 */
export function applyIndicatorParamChange(
  params: IndicatorParamOverrides,
  id: IndicatorCatalogId,
  key: string,
  raw: string,
): IndicatorParamOverrides | null {
  const parsed = Number(raw);
  const next: IndicatorParamOverrides = { ...params };
  const keys = editableParamKeys(id);
  const field = keys.find((item) => item.key === key);
  if (!field) {
    return null;
  }

  if (!Number.isFinite(parsed) || parsed < field.min || parsed > field.max) {
    const patch = { ...(next[id] ?? {}) };
    patch[key] = parsed;
    next[id] = patch;
    return next;
  }

  const defaults = INDICATOR_CATALOG_BY_ID[id].params;
  const patch = { ...(next[id] ?? {}) };
  if (parsed === defaults[key]) {
    delete patch[key];
  } else {
    patch[key] = parsed;
  }
  if (Object.keys(patch).length === 0) {
    delete next[id];
  } else {
    next[id] = patch;
  }
  return next;
}

export function resolvedIndicatorParamValue(
  params: IndicatorParamOverrides,
  id: IndicatorCatalogId,
  key: string,
): number {
  const override = params[id]?.[key];
  if (override !== undefined) {
    return override;
  }
  return INDICATOR_CATALOG_BY_ID[id].params[key]!;
}

/** 表示値が編集可能範囲外か。 */
export function isIndicatorParamOutOfRange(
  params: IndicatorParamOverrides,
  id: IndicatorCatalogId,
  key: string,
): boolean {
  const keys = editableParamKeys(id);
  const field = keys.find((item) => item.key === key);
  if (!field) {
    return false;
  }
  const value = resolvedIndicatorParamValue(params, id, key);
  return value < field.min || value > field.max;
}

export function IndicatorParamEditor({
  enabledIds,
  params,
  onChange,
}: IndicatorParamEditorProps) {
  const editableIds = useMemo(() => {
    return [...enabledIds].filter((id) => editableParamKeys(id).length > 0);
  }, [enabledIds]);

  if (editableIds.length === 0) {
    return (
      <details open style={detailsStyle} data-testid="indicator-param-editor">
        <summary style={summaryStyle}>
          指標パラメータ
          <span style={summaryHintStyle}>編集可能な指標なし</span>
        </summary>
        <p style={hintStyle} data-testid="indicator-param-editor-empty">
          パラメータを編集できる指標がありません
        </p>
      </details>
    );
  }

  function setParam(id: IndicatorCatalogId, key: string, raw: string) {
    const next = applyIndicatorParamChange(params, id, key, raw);
    if (next) {
      onChange(next);
    }
  }

  function paramValue(id: IndicatorCatalogId, key: string): number {
    return resolvedIndicatorParamValue(params, id, key);
  }

  function isOutOfRange(id: IndicatorCatalogId, key: string): boolean {
    return isIndicatorParamOutOfRange(params, id, key);
  }

  return (
    <details open style={detailsStyle} data-testid="indicator-param-editor">
      <summary style={summaryStyle}>
        指標パラメータ
        <span style={summaryHintStyle}>{editableIds.length} 件の指標</span>
      </summary>
      <ul style={listStyle}>
        {editableIds.map((id) => {
          const def = INDICATOR_CATALOG_BY_ID[id];
          return (
            <li key={id} style={itemStyle} data-testid={`param-editor-${id}`}>
              <strong>{def.nameJa}</strong>
              <div style={fieldsStyle}>
                {editableParamKeys(id).map((field) => (
                  <label key={field.key} style={labelStyle}>
                    {field.key}
                    <input
                      type="number"
                      value={paramValue(id, field.key)}
                      min={field.min}
                      max={field.max}
                      step={field.key === 'step' || field.key === 'maxStep' ? 0.01 : 1}
                      onChange={(e) => setParam(id, field.key, e.target.value)}
                      style={inputStyle}
                      data-testid={`param-${id}-${field.key}`}
                    />
                    {isOutOfRange(id, field.key) ? (
                      <span style={errorStyle}>
                        {field.min}〜{field.max}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

const detailsStyle: CSSProperties = {
  border: '1px solid rgba(232, 238, 245, 0.2)',
  borderRadius: 4,
  padding: '0.35rem 0.6rem',
};

const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.95rem',
};

const summaryHintStyle: CSSProperties = {
  display: 'block',
  fontWeight: 400,
  opacity: 0.75,
  fontSize: '0.75rem',
  marginTop: '0.15rem',
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: '0.5rem 0 0',
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
};

const itemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.85rem',
};

const fieldsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
  fontSize: '0.75rem',
};

const inputStyle: CSSProperties = {
  width: '4.5rem',
  padding: '0.25rem 0.35rem',
  borderRadius: 4,
  border: '1px solid rgba(232, 238, 245, 0.35)',
  background: 'rgba(0,0,0,0.25)',
  color: '#e8eef5',
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.8rem',
  opacity: 0.75,
};

const errorStyle: CSSProperties = {
  color: '#ffb4b4',
  fontSize: '0.7rem',
};
