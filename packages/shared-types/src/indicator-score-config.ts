/**
 * 指標セットのスコア配点・売買閾値（ADR 014）。
 *
 * グループ配点は合計 100% 必須。閾値は買い > 売り、-100〜100。
 */

import {
  INDICATOR_CATEGORIES,
  TREND_SCORE_GROUP_WEIGHTS,
  isIndicatorCategoryId,
  type IndicatorCategoryId,
} from './indicator-catalog';
import { DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS } from './signal-from-catalog';

/** 6 グループの配点（合計 100）。 */
export type GroupWeights = Record<IndicatorCategoryId, number>;

export type GroupWeightsValidationResult =
  | { ok: true; weights: GroupWeights }
  | { ok: false; reason: 'missing' | 'invalid' | 'sum' };

export type SignalThresholdsValidationResult =
  | { ok: true; buyThreshold: number; sellThreshold: number }
  | { ok: false; reason: 'range' | 'order' };

/** 部分指定を ADR 007 既定へマージする。 */
export function resolveGroupWeights(partial?: Partial<GroupWeights> | null): GroupWeights {
  if (partial == null) {
    return { ...TREND_SCORE_GROUP_WEIGHTS };
  }
  const result = { ...TREND_SCORE_GROUP_WEIGHTS };
  for (const category of INDICATOR_CATEGORIES) {
    const value = partial[category.id];
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[category.id] = value;
    }
  }
  return result;
}

/** 閾値を解決する。null/undefined は既定。 */
export function resolveSignalThresholds(input?: {
  buyThreshold?: number | null;
  sellThreshold?: number | null;
}): { buyThreshold: number; sellThreshold: number } {
  return {
    buyThreshold:
      input?.buyThreshold ?? DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS.buyThreshold,
    sellThreshold:
      input?.sellThreshold ?? DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS.sellThreshold,
  };
}

/** 6 キー必須・各値 > 0・合計厳密に 100。 */
export function validateGroupWeights(value: unknown): GroupWeightsValidationResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: 'missing' };
  }
  const record = value as Record<string, unknown>;
  const weights = {} as GroupWeights;
  let sum = 0;
  for (const category of INDICATOR_CATEGORIES) {
    const raw = record[category.id];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
      return { ok: false, reason: 'invalid' };
    }
    weights[category.id] = raw;
    sum += raw;
  }
  if (Math.abs(sum - 100) > 1e-9) {
    return { ok: false, reason: 'sum' };
  }
  return { ok: true, weights };
}

/** buy > sell、各 -100〜100。 */
export function validateSignalThresholds(
  buyThreshold: unknown,
  sellThreshold: unknown,
): SignalThresholdsValidationResult {
  if (
    typeof buyThreshold !== 'number' ||
    !Number.isFinite(buyThreshold) ||
    typeof sellThreshold !== 'number' ||
    !Number.isFinite(sellThreshold) ||
    buyThreshold < -100 ||
    buyThreshold > 100 ||
    sellThreshold < -100 ||
    sellThreshold > 100
  ) {
    return { ok: false, reason: 'range' };
  }
  if (buyThreshold <= sellThreshold) {
    return { ok: false, reason: 'order' };
  }
  return { ok: true, buyThreshold, sellThreshold };
}

/** GroupWeights として妥当か（validateGroupWeights の簡易版）。 */
export function isGroupWeights(value: unknown): value is GroupWeights {
  return validateGroupWeights(value).ok;
}

/** JSON クエリ用にシリアライズする。 */
export function serializeGroupWeights(weights: GroupWeights): string {
  return JSON.stringify(weights);
}

/** JSON クエリからパースする。不正なら null。 */
export function parseGroupWeightsJson(raw: string): GroupWeights | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = validateGroupWeights(parsed);
    return result.ok ? result.weights : null;
  } catch {
    return null;
  }
}

/** カテゴリ ID の配列（表示順）。 */
export function scoreGroupCategoryIds(): IndicatorCategoryId[] {
  return INDICATOR_CATEGORIES.map((category) => category.id);
}

/** 未知キーを除いた部分 GroupWeights。 */
export function sanitizePartialGroupWeights(
  value: unknown,
): Partial<GroupWeights> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const partial: Partial<GroupWeights> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (!isIndicatorCategoryId(key) || typeof raw !== 'number' || !Number.isFinite(raw)) {
      continue;
    }
    partial[key] = raw;
  }
  return partial;
}
