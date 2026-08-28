/**
 * テクニカル分析 API の共有 DTO。
 *
 * NestJS が日足を読み FastAPI に委譲した結果を、web / api で同じ形で扱う。
 * ウォームアップ不足の値は null（系列長は日付と揃える）。
 * 指標セットの正本は indicator-catalog.ts（ADR 006）。
 */

import {
  INDICATOR_CATALOG_BY_ID,
  computeCatalogIds,
  isIndicatorCatalogId,
  isIndicatorComputeType,
  type IndicatorCatalogId,
  type IndicatorComputeType,
} from './indicator-catalog';
import {
  effectiveLookbackBars,
  resolveIndicatorParams,
  type IndicatorParamOverrides,
} from './indicator-param-rules';

export type { IndicatorCatalogId, IndicatorComputeType };
/** @deprecated ADR 006 以降は IndicatorComputeType を使う。シグナル計算の 4 種と名前が重なるため残す。 */
export type IndicatorType = IndicatorComputeType;

/** 1 指標の要求パラメータ（レスポンスのエコーにも使う）。 */
export interface IndicatorRequestSpec {
  id: IndicatorCatalogId;
  type: IndicatorComputeType;
  params: Record<string, number>;
}

/**
 * 1 日分の指標値。キーはカタログの series.key（sma25, bbUpper など）。
 * ウォームアップ中は number ではなく null。
 */
export interface IndicatorSeriesPoint {
  date: string;
  values: Record<string, number | null>;
}

/** フィボナッチ水平線（表示期間の高値〜安値）。 */
export interface FibonacciDrawing {
  high: number;
  low: number;
  highDate: string;
  lowDate: string;
  levels: { ratio: number; price: number }[];
}

/** Volume Profile の 1 ビン。 */
export interface VolumeProfileBin {
  priceLow: number;
  priceHigh: number;
  volume: number;
}

/** 日付列ではない描画データ。 */
export interface IndicatorDrawings {
  fibonacci?: FibonacciDrawing;
  volumeProfile?: { bins: VolumeProfileBin[] };
}

/** Nest 公開 API / analysis 内部 API 共通の指標応答。 */
export interface IndicatorsResponseDto {
  /** Nest 経由のときのみ付与。analysis 直叩きでは省略可。 */
  symbolId?: string;
  indicators: IndicatorRequestSpec[];
  points: IndicatorSeriesPoint[];
  drawings?: IndicatorDrawings;
}

/** analysis 内部向け OHLC 1 本（日足）。 */
export interface AnalysisOhlcBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** analysis `POST /indicators` のリクエスト体。 */
export interface ComputeIndicatorsRequest {
  bars: AnalysisOhlcBar[];
  indicators: IndicatorRequestSpec[];
  /**
   * 表示期間の先頭インデックス。
   * VWAP / フィボナッチ / Volume Profile はこれ以降のバーだけを使う。
   */
  rangeStartIndex?: number;
}

/** カタログ ID から analysis 向けスペックを組み立てる。計算しない ID は除く。 */
export function specsFromCatalogIds(
  ids: IndicatorCatalogId[],
  paramOverrides?: IndicatorParamOverrides | null,
): IndicatorRequestSpec[] {
  return computeCatalogIds(ids).map((id) => {
    const def = INDICATOR_CATALOG_BY_ID[id];
    return {
      id,
      type: def.computeType as IndicatorComputeType,
      params: resolveIndicatorParams(id, paramOverrides),
    };
  });
}

/** IndicatorComputeType として妥当かを判定する。 */
export function isIndicatorType(value: unknown): value is IndicatorComputeType {
  return isIndicatorComputeType(value);
}

/** IndicatorRequestSpec として妥当かを判定する。 */
export function isIndicatorRequestSpec(value: unknown): value is IndicatorRequestSpec {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!isIndicatorCatalogId(record.id) || !isIndicatorComputeType(record.type)) {
    return false;
  }
  if (record.params === null || typeof record.params !== 'object' || Array.isArray(record.params)) {
    return false;
  }
  const params = record.params as Record<string, unknown>;
  for (const paramValue of Object.values(params)) {
    if (typeof paramValue !== 'number' || !Number.isFinite(paramValue)) {
      return false;
    }
  }
  return true;
}

function isNullableNumberMap(value: unknown): value is Record<string, number | null> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (entry !== null && typeof entry !== 'number') {
      return false;
    }
  }
  return true;
}

/** IndicatorSeriesPoint として妥当かを判定する。 */
export function isIndicatorSeriesPoint(value: unknown): value is IndicatorSeriesPoint {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.date !== 'string') {
    return false;
  }
  return isNullableNumberMap(record.values);
}

function isFibonacciDrawing(value: unknown): value is FibonacciDrawing {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.high !== 'number' ||
    typeof record.low !== 'number' ||
    typeof record.highDate !== 'string' ||
    typeof record.lowDate !== 'string' ||
    !Array.isArray(record.levels)
  ) {
    return false;
  }
  return record.levels.every((level) => {
    if (level === null || typeof level !== 'object') {
      return false;
    }
    const row = level as Record<string, unknown>;
    return typeof row.ratio === 'number' && typeof row.price === 'number';
  });
}

function isVolumeProfileBin(value: unknown): value is VolumeProfileBin {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.priceLow === 'number' &&
    typeof record.priceHigh === 'number' &&
    typeof record.volume === 'number'
  );
}

export function isIndicatorDrawings(value: unknown): value is IndicatorDrawings {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  // FastAPI / Pydantic は未設定の optional を JSON null で出すことがある。
  if (record.fibonacci != null && !isFibonacciDrawing(record.fibonacci)) {
    return false;
  }
  if (record.volumeProfile != null) {
    if (typeof record.volumeProfile !== 'object' || Array.isArray(record.volumeProfile)) {
      return false;
    }
    const profile = record.volumeProfile as Record<string, unknown>;
    if (!Array.isArray(profile.bins) || !profile.bins.every(isVolumeProfileBin)) {
      return false;
    }
  }
  return true;
}

/** IndicatorsResponseDto を組み立てるファクトリ。 */
export function createIndicatorsResponseDto(
  input: IndicatorsResponseDto,
): IndicatorsResponseDto {
  const dto: IndicatorsResponseDto = {
    indicators: input.indicators,
    points: input.points,
  };
  if (input.symbolId !== undefined) {
    dto.symbolId = input.symbolId;
  }
  if (input.drawings != null) {
    dto.drawings = input.drawings;
  }
  return dto;
}

/** 未知の JSON が IndicatorsResponseDto として妥当かを判定する。 */
export function isIndicatorsResponseDto(value: unknown): value is IndicatorsResponseDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.symbolId !== undefined && typeof record.symbolId !== 'string') {
    return false;
  }
  if (!Array.isArray(record.indicators) || !Array.isArray(record.points)) {
    return false;
  }
  if (!record.indicators.every(isIndicatorRequestSpec)) {
    return false;
  }
  if (!record.points.every(isIndicatorSeriesPoint)) {
    return false;
  }
  if (record.drawings != null && !isIndicatorDrawings(record.drawings)) {
    return false;
  }
  return true;
}

/**
 * 指定指標セットの計算に必要な最小 lookback 本数を返す。
 * Nest が `from` より前に余分に日足を読むときに使う。
 */
export function computeIndicatorLookback(specs: IndicatorRequestSpec[]): number {
  let max = 0;
  for (const spec of specs) {
    max = Math.max(max, effectiveLookbackBars(spec.id, spec.params));
  }
  return max;
}

/** 一目の先行スパンなど、最終バーより先に付ける本数。 */
export function computeIndicatorFutureBars(specs: IndicatorRequestSpec[]): number {
  let max = 0;
  for (const spec of specs) {
    const def = INDICATOR_CATALOG_BY_ID[spec.id];
    max = Math.max(max, def.futureBars);
  }
  return max;
}
