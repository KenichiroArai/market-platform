/**
 * チャート分析の指標カタログ（分類アコーディオン）。
 *
 * 同じ ID が複数分類に出ても ON/OFF は共有する。
 * エリオットは説明のみでチェック不可。
 */
'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import {
  INDICATOR_CATEGORIES,
  INDICATOR_CATALOG_BY_ID,
  defaultEnabledIndicatorIds,
  definitionsForCategory,
  recommendedIndicatorIds,
  type IndicatorCatalogId,
  type IndicatorDefinition,
} from '@market/shared-types';

export type IndicatorCatalogProps = {
  enabledIds: Set<IndicatorCatalogId>;
  onChange: (next: Set<IndicatorCatalogId>) => void;
};

/** おすすめ構成（生出来高は残す）。 */
export function applyRecommendedIds(current: Set<IndicatorCatalogId>): Set<IndicatorCatalogId> {
  const next = new Set<IndicatorCatalogId>(recommendedIndicatorIds());
  if (current.has('volume')) {
    next.add('volume');
  }
  return next;
}

/** すべて解除。 */
export function clearIndicatorIds(): Set<IndicatorCatalogId> {
  return new Set();
}

export function toggleIndicatorId(
  current: Set<IndicatorCatalogId>,
  id: IndicatorCatalogId,
): Set<IndicatorCatalogId> {
  const def = INDICATOR_CATALOG_BY_ID[id];
  if (def.disabled) {
    return current;
  }
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function IndicatorCatalog({ enabledIds, onChange }: IndicatorCatalogProps) {
  const [focusedId, setFocusedId] = useState<IndicatorCatalogId | null>(null);

  const focused: IndicatorDefinition | null = focusedId
    ? INDICATOR_CATALOG_BY_ID[focusedId]
    : null;

  const enabledList = useMemo(() => [...enabledIds], [enabledIds]);

  return (
    <aside style={asideStyle} data-testid="indicator-catalog">
      <div style={actionsStyle}>
        <button
          type="button"
          style={buttonStyle}
          data-testid="apply-recommended"
          onClick={() => onChange(applyRecommendedIds(enabledIds))}
        >
          おすすめ構成を適用
        </button>
        <button
          type="button"
          style={buttonStyle}
          data-testid="clear-indicators"
          onClick={() => onChange(clearIndicatorIds())}
        >
          すべて解除
        </button>
      </div>

      {INDICATOR_CATEGORIES.map((category) => (
        <details key={category.id} open style={detailsStyle}>
          <summary style={summaryStyle}>
            {category.nameJa}
            <span style={purposeStyle}>{category.purpose}</span>
          </summary>
          <ul style={listStyle}>
            {definitionsForCategory(category.id).map((item) => (
              <li key={`${category.id}-${item.id}`}>
                <label style={itemLabelStyle}>
                  <input
                    type="checkbox"
                    disabled={item.disabled}
                    checked={enabledIds.has(item.id)}
                    onChange={() => onChange(toggleIndicatorId(enabledIds, item.id))}
                    onFocus={() => setFocusedId(item.id)}
                    data-testid={`overlay-${item.id}`}
                  />
                  <span>
                    <span style={{ display: 'block' }}>{item.nameJa}</span>
                    <span style={purposeStyle}>{item.shortPurpose}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </details>
      ))}

      <section style={descStyle} data-testid="indicator-description">
        <h2 style={descTitleStyle}>{focused ? focused.nameJa : '指標の説明'}</h2>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          {focused
            ? focused.description
            : '指標名をクリックすると、計算の概要と見方を表示します。'}
        </p>
        {enabledList.length > 0 ? (
          <p style={purposeStyle}>選択中: {enabledList.length} 件</p>
        ) : null}
      </section>
    </aside>
  );
}

export const INITIAL_ENABLED_IDS: IndicatorCatalogId[] = defaultEnabledIndicatorIds();

const asideStyle: CSSProperties = {
  minWidth: '16rem',
  maxWidth: '20rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
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

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: '0.5rem 0 0',
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const itemLabelStyle: CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  alignItems: 'flex-start',
  fontSize: '0.85rem',
};

const purposeStyle: CSSProperties = {
  display: 'block',
  fontWeight: 400,
  opacity: 0.75,
  fontSize: '0.75rem',
  marginTop: '0.15rem',
};

const descStyle: CSSProperties = {
  border: '1px solid rgba(232, 238, 245, 0.2)',
  borderRadius: 4,
  padding: '0.75rem',
  fontSize: '0.85rem',
};

const descTitleStyle: CSSProperties = {
  fontSize: '0.95rem',
  margin: '0 0 0.4rem',
};
