/**
 * スコア配点・買い売り閾値の編集（ADR 014）。
 *
 * グループ配点は合計 100% 必須。閾値は買い > 売り。
 */
'use client';

import { useMemo, type CSSProperties } from 'react';
import {
  INDICATOR_CATEGORIES,
  TREND_SCORE_GROUP_WEIGHTS,
  validateGroupWeights,
  validateSignalThresholds,
  type GroupWeights,
} from '@market/shared-types';

export type IndicatorScoreConfigFormProps = {
  groupWeights: GroupWeights;
  buyThreshold: number;
  sellThreshold: number;
  onGroupWeightsChange: (next: GroupWeights) => void;
  onBuyThresholdChange: (value: number) => void;
  onSellThresholdChange: (value: number) => void;
};

export function isScoreConfigValid(
  groupWeights: GroupWeights,
  buyThreshold: number,
  sellThreshold: number,
): boolean {
  return (
    validateGroupWeights(groupWeights).ok &&
    validateSignalThresholds(buyThreshold, sellThreshold).ok
  );
}

/** 数値入力をパースする。非有限値は null。 */
export function parseScoreWeightInput(raw: string): number | null {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** グループ配点の 1 セルを更新する。 */
export function applyGroupWeightChange(
  groupWeights: GroupWeights,
  categoryId: keyof GroupWeights,
  raw: string,
): GroupWeights | null {
  const parsed = parseScoreWeightInput(raw);
  if (parsed === null) {
    return null;
  }
  return { ...groupWeights, [categoryId]: parsed };
}

export function IndicatorScoreConfigForm({
  groupWeights,
  buyThreshold,
  sellThreshold,
  onGroupWeightsChange,
  onBuyThresholdChange,
  onSellThresholdChange,
}: IndicatorScoreConfigFormProps) {
  const sum = useMemo(
    () => Object.values(groupWeights).reduce((total, value) => total + value, 0),
    [groupWeights],
  );
  const weightsValid = validateGroupWeights(groupWeights).ok;
  const thresholdsValid = validateSignalThresholds(buyThreshold, sellThreshold).ok;

  function setWeight(categoryId: keyof GroupWeights, raw: string) {
    const next = applyGroupWeightChange(groupWeights, categoryId, raw);
    if (next) {
      onGroupWeightsChange(next);
    }
  }

  return (
    <section style={sectionStyle} data-testid="indicator-score-config">
      <h3 style={headingStyle}>スコア設定</h3>
      <p style={hintStyle}>グループ配点（合計 100%）</p>
      <div style={gridStyle}>
        {INDICATOR_CATEGORIES.map((category) => (
          <label key={category.id} style={labelStyle}>
            {category.nameJa}
            <input
              type="number"
              min={1}
              max={100}
              value={groupWeights[category.id]}
              onChange={(e) => setWeight(category.id, e.target.value)}
              style={inputStyle}
              data-testid={`group-weight-${category.id}`}
            />
          </label>
        ))}
      </div>
      <p
        style={sum === 100 && weightsValid ? okStyle : errorStyle}
        data-testid="group-weight-sum"
      >
        合計: {sum}% {weightsValid ? '' : '（100% にしてください）'}
      </p>

      <p style={hintStyle}>買い / 売り判定スコア</p>
      <div style={thresholdRowStyle}>
        <label style={labelStyle}>
          買い ≥
          <input
            type="number"
            min={-100}
            max={100}
            step={0.5}
            value={buyThreshold}
            onChange={(e) => onBuyThresholdChange(Number(e.target.value))}
            style={inputStyle}
            data-testid="buy-threshold"
          />
        </label>
        <label style={labelStyle}>
          売り ≤
          <input
            type="number"
            min={-100}
            max={100}
            step={0.5}
            value={sellThreshold}
            onChange={(e) => onSellThresholdChange(Number(e.target.value))}
            style={inputStyle}
            data-testid="sell-threshold"
          />
        </label>
      </div>
      {!thresholdsValid ? (
        <p style={errorStyle} data-testid="threshold-error">
          買い閾値は売り閾値より大きく、-100〜100 の範囲にしてください
        </p>
      ) : null}
    </section>
  );
}

/** 既定のグループ配点を返す。 */
export function defaultGroupWeights(): GroupWeights {
  return { ...TREND_SCORE_GROUP_WEIGHTS };
}

const sectionStyle: CSSProperties = {
  border: '1px solid rgba(232, 238, 245, 0.2)',
  borderRadius: 4,
  padding: '0.6rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.75rem',
  opacity: 0.8,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.4rem',
};

const thresholdRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
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

const okStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.8rem',
  color: '#b4e0b4',
};

const errorStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.8rem',
  color: '#ffb4b4',
};
