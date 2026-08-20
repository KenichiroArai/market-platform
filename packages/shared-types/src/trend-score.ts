/**
 * トレンドスコア API の共有 DTO（ADR 007）。
 *
 * 日足ごとに指標を 1 グループへ固定して採点し、配点で総合 ±100 を合成する。
 * 計算は FastAPI、Nest はゲートウェイ。結果は DB に保存しない。
 */

import type { IndicatorCatalogId, IndicatorCategoryId } from './indicator-catalog';
import { isIndicatorCatalogId, isIndicatorCategoryId } from './indicator-catalog';

/** 6 グループの寄与点（配点スケール後。合計が総合スコア）。 */
export type TrendScoreGroupContrib = Record<IndicatorCategoryId, number | null>;

/** 1 日分のトレンドスコア。 */
export interface TrendScorePoint {
  date: string;
  /** 総合スコア。全グループが null のときは null。 */
  score: number | null;
  groups: TrendScoreGroupContrib;
  /** 指標 ID → 点数。ウォームアップ中は null。 */
  indicators: Record<string, number | null>;
}

/** Nest 公開 API / analysis 内部 API 共通のトレンドスコア応答。 */
export interface TrendScoreResponseDto {
  symbolId?: string;
  points: TrendScorePoint[];
}

/** analysis `POST /trend-score` のリクエスト体。 */
export interface ComputeTrendScoreRequest {
  bars: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  rangeStartIndex?: number;
}

/** 状態ラベルの区分（総合スコア表の中点）。 */
export interface TrendScoreState {
  id:
    | 'strongUp'
    | 'upTrend'
    | 'rangeUp'
    | 'range'
    | 'rangeDown'
    | 'downTrend'
    | 'strongDown';
  labelJa: string;
  min: number;
}

export const TREND_SCORE_STATES: TrendScoreState[] = [
  { id: 'strongUp', labelJa: '非常に強い上昇', min: 77.5 },
  { id: 'upTrend', labelJa: '上昇トレンド', min: 37.5 },
  { id: 'rangeUp', labelJa: 'レンジだがやや上向き', min: 7.5 },
  { id: 'range', labelJa: '完全なレンジ', min: -10 },
  { id: 'rangeDown', labelJa: 'レンジだがやや下向き', min: -42.5 },
  { id: 'downTrend', labelJa: '下降トレンド', min: -80 },
  { id: 'strongDown', labelJa: '暴落に近い強い下降', min: Number.NEGATIVE_INFINITY },
];

/** ゲージ用のスコア範囲（横棒 -100〜+100）。 */
export const TREND_SCORE_GAUGE_MIN = -100;
export const TREND_SCORE_GAUGE_MAX = 100;

/** 横棒ゲージ 1 区間（左端 from → 右端 to）。 */
export interface TrendScoreGaugeSegment {
  id: TrendScoreState['id'];
  labelJa: string;
  /** 区間の下限（含む）。 */
  from: number;
  /** 区間の上限（最終区間以外は含まない扱いで幅計算）。 */
  to: number;
}

/**
 * 横棒ゲージ用に状態区分を左（下落）→右（上昇）へ並べる。
 * strongDown の実表示下限は -100 に揃える。
 */
export function trendScoreGaugeSegments(): TrendScoreGaugeSegment[] {
  const ordered = [...TREND_SCORE_STATES].reverse();
  return ordered.map((state, index) => {
    const next = ordered[index + 1];
    const from = state.min === Number.NEGATIVE_INFINITY ? TREND_SCORE_GAUGE_MIN : state.min;
    const to = next === undefined ? TREND_SCORE_GAUGE_MAX : next.min;
    return { id: state.id, labelJa: state.labelJa, from, to };
  });
}

/** 総合スコアをゲージ上の位置（0〜100%）にする。範囲外は端へクランプ。 */
export function scoreToGaugePercent(score: number): number {
  const span = TREND_SCORE_GAUGE_MAX - TREND_SCORE_GAUGE_MIN;
  const clamped = Math.max(TREND_SCORE_GAUGE_MIN, Math.min(TREND_SCORE_GAUGE_MAX, score));
  return ((clamped - TREND_SCORE_GAUGE_MIN) / span) * 100;
}

/** 総合スコアから状態ラベルを返す。score が null のときはレンジ扱い。 */
export function trendScoreState(score: number | null): TrendScoreState {
  const value = score ?? 0;
  const lastIndex = TREND_SCORE_STATES.length - 1;
  for (let i = 0; i < lastIndex; i += 1) {
    const state = TREND_SCORE_STATES[i]!;
    if (value >= state.min) {
      return state;
    }
  }
  return TREND_SCORE_STATES[lastIndex] as TrendScoreState;
}

/**
 * 該当区間の説明文。score が null のときは算出不可と返す。
 * 例: 「総合スコア 42 は「上昇トレンド」（37.5〜77.5）に該当します。」
 */
export function trendScoreGaugeExplanation(score: number | null): string {
  if (score === null) {
    return '総合スコアがまだ算出できないため、状態区分を示せません。';
  }
  const state = trendScoreState(score);
  // segments は TREND_SCORE_STATES と同じ id 集合なので必ず見つかる
  const segment = trendScoreGaugeSegments().find((entry) => entry.id === state.id)!;
  const rounded = Math.round(score);
  return `総合スコア ${rounded} は「${state.labelJa}」（${segment.from}〜${segment.to}）に該当します。`;
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

function isTrendScoreGroupContrib(value: unknown): value is TrendScoreGroupContrib {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys: IndicatorCategoryId[] = [
    'trend',
    'momentum',
    'oscillator',
    'volatility',
    'volume',
    'cycle',
  ];
  for (const key of keys) {
    const entry = record[key];
    if (entry !== null && typeof entry !== 'number') {
      return false;
    }
  }
  return keys.every((key) => key in record);
}

/** TrendScorePoint として妥当かを判定する。 */
export function isTrendScorePoint(value: unknown): value is TrendScorePoint {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.date !== 'string') {
    return false;
  }
  if (record.score !== null && typeof record.score !== 'number') {
    return false;
  }
  if (!isTrendScoreGroupContrib(record.groups)) {
    return false;
  }
  return isNullableNumberMap(record.indicators);
}

/** TrendScoreResponseDto を組み立てるファクトリ。 */
export function createTrendScoreResponseDto(input: TrendScoreResponseDto): TrendScoreResponseDto {
  const dto: TrendScoreResponseDto = {
    points: input.points,
  };
  if (input.symbolId !== undefined) {
    dto.symbolId = input.symbolId;
  }
  return dto;
}

/** 未知の JSON が TrendScoreResponseDto として妥当かを判定する。 */
export function isTrendScoreResponseDto(value: unknown): value is TrendScoreResponseDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.symbolId !== undefined && typeof record.symbolId !== 'string') {
    return false;
  }
  if (!Array.isArray(record.points)) {
    return false;
  }
  return record.points.every(isTrendScorePoint);
}

/** スコア対象 ID として妥当か（テスト・デバッグ用）。 */
export function isScoredIndicatorId(value: unknown): value is IndicatorCatalogId {
  return isIndicatorCatalogId(value);
}

/** グループ ID として妥当か。 */
export function isTrendScoreGroupId(value: unknown): value is IndicatorCategoryId {
  return isIndicatorCategoryId(value);
}
