/**
 * 指標パラメータ上書きのルールとバリデーション（ADR 014）。
 *
 * カタログ既定キーのみ編集可。範囲はキー名に基づく共通 bounds。
 */

import {
  INDICATOR_CATALOG,
  INDICATOR_CATALOG_BY_ID,
  isIndicatorCatalogId,
  type IndicatorCatalogId,
} from './indicator-catalog';

/** カタログ ID ごとのパラメータ上書き（差分のみ）。 */
export type IndicatorParamOverrides = Partial<
  Record<IndicatorCatalogId, Record<string, number>>
>;

export type IndicatorParamValidationResult =
  | { ok: true; overrides: IndicatorParamOverrides }
  | { ok: false; reason: 'unknown_id' | 'unknown_key' | 'out_of_range'; detail?: string };

/** パラメータキーごとの min/max。 */
const PARAM_BOUNDS: Record<string, { min: number; max: number }> = {
  period: { min: 2, max: 500 },
  fast: { min: 2, max: 100 },
  slow: { min: 2, max: 200 },
  signal: { min: 2, max: 50 },
  tenkan: { min: 2, max: 100 },
  kijun: { min: 2, max: 200 },
  senkouB: { min: 2, max: 300 },
  displacement: { min: 1, max: 100 },
  step: { min: 0.001, max: 0.5 },
  maxStep: { min: 0.01, max: 1 },
  kPeriod: { min: 2, max: 100 },
  kSmoothing: { min: 1, max: 50 },
  dPeriod: { min: 1, max: 50 },
  stdDev: { min: 0.1, max: 10 },
  emaPeriod: { min: 2, max: 500 },
  atrPeriod: { min: 2, max: 200 },
  multiplier: { min: 0.1, max: 10 },
  bins: { min: 5, max: 100 },
};

function boundsForKey(key: string): { min: number; max: number } {
  const bounds = PARAM_BOUNDS[key as keyof typeof PARAM_BOUNDS];
  if (bounds) {
    return bounds;
  }
  /* istanbul ignore next -- defensive fallback for future catalog param keys */
  return { min: 1, max: 1000 };
}

/** カタログ既定 + 上書きをマージする。 */
export function resolveIndicatorParams(
  id: IndicatorCatalogId,
  overrides?: IndicatorParamOverrides | null,
): Record<string, number> {
  const def = INDICATOR_CATALOG_BY_ID[id];
  const base = { ...def.params };
  const patch = overrides?.[id];
  if (!patch) {
    return base;
  }
  return { ...base, ...patch };
}

/** 上書きオブジェクト全体を検証する。空オブジェクトは OK。 */
export function validateIndicatorParamOverrides(
  value: unknown,
): IndicatorParamValidationResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: true, overrides: {} };
  }
  const record = value as Record<string, unknown>;
  const overrides: IndicatorParamOverrides = {};

  for (const [idRaw, paramsRaw] of Object.entries(record)) {
    if (!isIndicatorCatalogId(idRaw)) {
      return { ok: false, reason: 'unknown_id', detail: idRaw };
    }
    const def = INDICATOR_CATALOG_BY_ID[idRaw];
    if (def.disabled || def.computeType === null) {
      return { ok: false, reason: 'unknown_id', detail: idRaw };
    }
    if (paramsRaw === null || typeof paramsRaw !== 'object' || Array.isArray(paramsRaw)) {
      return { ok: false, reason: 'unknown_key', detail: idRaw };
    }
    const paramsRecord = paramsRaw as Record<string, unknown>;
    const merged: Record<string, number> = {};
    for (const [key, rawValue] of Object.entries(paramsRecord)) {
      if (!(key in def.params)) {
        return { ok: false, reason: 'unknown_key', detail: `${idRaw}.${key}` };
      }
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
        return { ok: false, reason: 'out_of_range', detail: `${idRaw}.${key}` };
      }
      const bounds = boundsForKey(key);
      if (rawValue < bounds.min || rawValue > bounds.max) {
        return { ok: false, reason: 'out_of_range', detail: `${idRaw}.${key}` };
      }
      merged[key] = rawValue;
    }
    if (Object.keys(merged).length > 0) {
      overrides[idRaw] = merged;
    }
  }

  return { ok: true, overrides };
}

/** IndicatorParamOverrides として妥当か。 */
export function isIndicatorParamOverrides(value: unknown): value is IndicatorParamOverrides {
  return validateIndicatorParamOverrides(value).ok;
}

/** JSON クエリ用シリアライズ。 */
export function serializeIndicatorParamOverrides(overrides: IndicatorParamOverrides): string {
  return JSON.stringify(overrides);
}

/** JSON クエリからパース。不正なら null。 */
export function parseIndicatorParamOverridesJson(raw: string): IndicatorParamOverrides | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = validateIndicatorParamOverrides(parsed);
    return result.ok ? result.overrides : null;
  } catch {
    return null;
  }
}

/** 編集可能なパラメータキーと bounds（UI 用）。 */
export function editableParamKeys(id: IndicatorCatalogId): Array<{
  key: string;
  defaultValue: number;
  min: number;
  max: number;
}> {
  const def = INDICATOR_CATALOG_BY_ID[id];
  if (def.disabled || def.computeType === null) {
    return [];
  }
  return Object.entries(def.params).map(([key, defaultValue]) => {
    const bounds = boundsForKey(key);
    return { key, defaultValue, min: bounds.min, max: bounds.max };
  });
}

/** トグル可能な全カタログ ID のうち params を持つもの。 */
export function catalogIdsWithParams(): IndicatorCatalogId[] {
  return INDICATOR_CATALOG.filter(
    (item) => !item.disabled && item.computeType !== null && Object.keys(item.params).length > 0,
  ).map((item) => item.id);
}

/** マージ後 params から lookback 本数を推定する。 */
export function effectiveLookbackBars(
  id: IndicatorCatalogId,
  params: Record<string, number>,
): number {
  const def = INDICATOR_CATALOG_BY_ID[id];
  if (id === 'macd') {
    return Math.max(def.lookbackBars, (params.slow ?? 26) + (params.signal ?? 9));
  }
  if (id === 'ichimoku') {
    const senkouB = params.senkouB ?? 52;
    const displacement = params.displacement ?? 26;
    return Math.max(def.lookbackBars, senkouB + displacement);
  }
  if (id === 'stoch') {
    const kPeriod = params.kPeriod ?? 14;
    const kSmoothing = params.kSmoothing ?? 3;
    const dPeriod = params.dPeriod ?? 3;
    return Math.max(def.lookbackBars, kPeriod + kSmoothing + dPeriod);
  }
  if (id === 'keltner') {
    return Math.max(
      def.lookbackBars,
      params.emaPeriod ?? 20,
      params.atrPeriod ?? 10,
    );
  }
  if (typeof params.period === 'number') {
    return Math.max(def.lookbackBars, params.period);
  }
  return def.lookbackBars;
}
