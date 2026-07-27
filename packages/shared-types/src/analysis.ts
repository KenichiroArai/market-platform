/**
 * テクニカル分析 API の共有 DTO。
 *
 * NestJS が日足を読み FastAPI に委譲した結果を、web / api で同じ形で扱う。
 * ウォームアップ不足の値は null（系列長は日付と揃える）。
 */

/** 対応するテクニカル指標の種類。 */
export type IndicatorType = 'sma' | 'ema' | 'rsi' | 'macd';

/** 既定の期間（ADR 004）。 */
export const DEFAULT_INDICATOR_PARAMS = {
  smaPeriod: 20,
  emaPeriod: 50,
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
} as const;

/** 1 指標の要求パラメータ（レスポンスのエコーにも使う）。 */
export type IndicatorRequestSpec =
  | { type: 'sma'; period: number }
  | { type: 'ema'; period: number }
  | { type: 'rsi'; period: number }
  | { type: 'macd'; fast: number; slow: number; signal: number };

/**
 * 1 日分の指標値。要求された指標のキーだけが入る。
 * ウォームアップ中は number ではなく null。
 */
export interface IndicatorSeriesPoint {
  date: string;
  sma?: number | null;
  ema?: number | null;
  rsi?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  macdHistogram?: number | null;
}

/** Nest 公開 API / analysis 内部 API 共通の指標応答。 */
export interface IndicatorsResponseDto {
  /** Nest 経由のときのみ付与。analysis 直叩きでは省略可。 */
  symbolId?: string;
  indicators: IndicatorRequestSpec[];
  points: IndicatorSeriesPoint[];
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
}

/** IndicatorType として妥当かを判定する。 */
export function isIndicatorType(value: unknown): value is IndicatorType {
  return value === 'sma' || value === 'ema' || value === 'rsi' || value === 'macd';
}

/** IndicatorRequestSpec として妥当かを判定する。 */
export function isIndicatorRequestSpec(value: unknown): value is IndicatorRequestSpec {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.type === 'sma' || record.type === 'ema' || record.type === 'rsi') {
    return typeof record.period === 'number' && Number.isFinite(record.period);
  }
  if (record.type === 'macd') {
    return (
      typeof record.fast === 'number' &&
      Number.isFinite(record.fast) &&
      typeof record.slow === 'number' &&
      Number.isFinite(record.slow) &&
      typeof record.signal === 'number' &&
      Number.isFinite(record.signal)
    );
  }
  return false;
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
  const optionalKeys = [
    'sma',
    'ema',
    'rsi',
    'macd',
    'macdSignal',
    'macdHistogram',
  ] as const;
  for (const key of optionalKeys) {
    if (key in record && record[key] !== null && typeof record[key] !== 'number') {
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
  return record.points.every(isIndicatorSeriesPoint);
}

/**
 * 指定指標セットの計算に必要な最小 lookback 本数を返す。
 * Nest が `from` より前に余分に日足を読むときに使う。
 * SMA/EMA/RSI は period、MACD は slow + signal（シグナル EMA のウォームアップ分）。
 */
export function computeIndicatorLookback(specs: IndicatorRequestSpec[]): number {
  let max = 0;
  for (const spec of specs) {
    if (spec.type === 'macd') {
      max = Math.max(max, spec.slow + spec.signal);
    } else {
      max = Math.max(max, spec.period);
    }
  }
  return max;
}
