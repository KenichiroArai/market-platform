/**
 * トレードプラン DTO（ADR 018 / v0.5.0 Phase 2）。
 *
 * 分析結果から売買判定・損切／利確・資金管理までを一枚にまとめた契約。
 */

/** 5 段階の売買判定。 */
export type TradeJudgmentLevel = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';

/** 損切方式コード。 */
export type StopLossMethod =
  | 'atr'
  | 'atr_x2'
  | 'recent_swing'
  | 'approx_support'
  | 'donchian_lower'
  | 'ma';

/** 利確方式コード。 */
export type TakeProfitMethod =
  | 'atr_multiple'
  | 'rr_target'
  | 'approx_resistance'
  | 'fibonacci'
  | 'donchian_upper'
  | 'none';

/** リスク評価ラベル。 */
export type RiskLevel = 'low' | 'medium' | 'high';

/** 価格候補（損切・利確など）。 */
export interface TradePlanPriceLevelDto {
  method: string;
  label: string;
  price: number;
  rationale: string;
  recommended: boolean;
}

/** エントリー判定。 */
export interface TradePlanJudgmentDto {
  level: TradeJudgmentLevel;
  /** 0–100（買い寄りが高い）。 */
  score: number;
  /** 1–5 の星相当。 */
  stars: number;
  label: string;
  factors: Array<{ id: string; label: string; contribution: number; note: string }>;
}

/** 推奨エントリー。 */
export interface TradePlanEntryDto {
  currentPrice: number;
  recommendedPrice: number;
  side: 'long' | 'short';
  rationale: string;
}

/** リスクリワード。 */
export interface TradePlanRiskRewardDto {
  entry: number;
  stop: number;
  target: number;
  riskReward: number;
}

/** ポジションサイズ。 */
export interface TradePlanPositionDto {
  recommendedShares: number;
  maxShares: number;
  requiredCapital: number;
  maxLoss: number;
  equity: number;
  riskRate: number;
}

/** リスク評価。 */
export interface TradePlanRiskRatingDto {
  level: RiskLevel;
  stars: number;
  atrPercent: number | null;
  notes: string[];
}

/** トレードプラン全体。 */
export interface TradePlanDto {
  symbolId: string;
  baseDate: string;
  judgment: TradePlanJudgmentDto;
  entry: TradePlanEntryDto;
  stopLossCandidates: TradePlanPriceLevelDto[];
  takeProfitCandidates: TradePlanPriceLevelDto[];
  recommendedStop: TradePlanPriceLevelDto | null;
  recommendedTarget: TradePlanPriceLevelDto | null;
  riskReward: TradePlanRiskRewardDto | null;
  position: TradePlanPositionDto | null;
  riskRating: TradePlanRiskRatingDto;
  buyReasons: string[];
  sellReasons: string[];
  overallScore: number;
  summaryLabel: string;
}

const JUDGMENT_LEVELS: TradeJudgmentLevel[] = [
  'strong_buy',
  'buy',
  'neutral',
  'sell',
  'strong_sell',
];

const STOP_METHODS: StopLossMethod[] = [
  'atr',
  'atr_x2',
  'recent_swing',
  'approx_support',
  'donchian_lower',
  'ma',
];

const TAKE_PROFIT_METHODS: TakeProfitMethod[] = [
  'atr_multiple',
  'rr_target',
  'approx_resistance',
  'fibonacci',
  'donchian_upper',
  'none',
];

const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high'];

export function isTradeJudgmentLevel(value: unknown): value is TradeJudgmentLevel {
  return typeof value === 'string' && JUDGMENT_LEVELS.includes(value as TradeJudgmentLevel);
}

export function isStopLossMethod(value: unknown): value is StopLossMethod {
  return typeof value === 'string' && STOP_METHODS.includes(value as StopLossMethod);
}

export function isTakeProfitMethod(value: unknown): value is TakeProfitMethod {
  return typeof value === 'string' && TAKE_PROFIT_METHODS.includes(value as TakeProfitMethod);
}

export function isRiskLevel(value: unknown): value is RiskLevel {
  return typeof value === 'string' && RISK_LEVELS.includes(value as RiskLevel);
}

function isPriceLevel(value: unknown): value is TradePlanPriceLevelDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.method === 'string' &&
    typeof r.label === 'string' &&
    typeof r.price === 'number' &&
    typeof r.rationale === 'string' &&
    typeof r.recommended === 'boolean'
  );
}

function isJudgment(value: unknown): value is TradePlanJudgmentDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    isTradeJudgmentLevel(r.level) &&
    typeof r.score === 'number' &&
    typeof r.stars === 'number' &&
    typeof r.label === 'string' &&
    Array.isArray(r.factors)
  );
}

function isEntry(value: unknown): value is TradePlanEntryDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.currentPrice === 'number' &&
    typeof r.recommendedPrice === 'number' &&
    (r.side === 'long' || r.side === 'short') &&
    typeof r.rationale === 'string'
  );
}

function isRiskReward(value: unknown): value is TradePlanRiskRewardDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.entry === 'number' &&
    typeof r.stop === 'number' &&
    typeof r.target === 'number' &&
    typeof r.riskReward === 'number'
  );
}

function isPosition(value: unknown): value is TradePlanPositionDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.recommendedShares === 'number' &&
    typeof r.maxShares === 'number' &&
    typeof r.requiredCapital === 'number' &&
    typeof r.maxLoss === 'number' &&
    typeof r.equity === 'number' &&
    typeof r.riskRate === 'number'
  );
}

function isRiskRating(value: unknown): value is TradePlanRiskRatingDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    isRiskLevel(r.level) &&
    typeof r.stars === 'number' &&
    (r.atrPercent === null || typeof r.atrPercent === 'number') &&
    Array.isArray(r.notes)
  );
}

/** 上流 JSON が TradePlanDto か検証する。 */
export function isTradePlanDto(value: unknown): value is TradePlanDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  if (typeof r.symbolId !== 'string' || typeof r.baseDate !== 'string') {
    return false;
  }
  if (!isJudgment(r.judgment) || !isEntry(r.entry)) {
    return false;
  }
  if (!Array.isArray(r.stopLossCandidates) || !r.stopLossCandidates.every(isPriceLevel)) {
    return false;
  }
  if (!Array.isArray(r.takeProfitCandidates) || !r.takeProfitCandidates.every(isPriceLevel)) {
    return false;
  }
  if (r.recommendedStop != null && !isPriceLevel(r.recommendedStop)) {
    return false;
  }
  if (r.recommendedTarget != null && !isPriceLevel(r.recommendedTarget)) {
    return false;
  }
  if (r.riskReward != null && !isRiskReward(r.riskReward)) {
    return false;
  }
  if (r.position != null && !isPosition(r.position)) {
    return false;
  }
  if (!isRiskRating(r.riskRating)) {
    return false;
  }
  if (!Array.isArray(r.buyReasons) || !Array.isArray(r.sellReasons)) {
    return false;
  }
  if (typeof r.overallScore !== 'number' || typeof r.summaryLabel !== 'string') {
    return false;
  }
  return true;
}

/** 検証済みオブジェクトを正規化する（浅いコピー）。 */
export function createTradePlanDto(value: TradePlanDto): TradePlanDto {
  return { ...value };
}

export const JUDGMENT_LEVEL_LABELS: Record<TradeJudgmentLevel, string> = {
  strong_buy: '買い',
  buy: 'やや買い',
  neutral: '中立',
  sell: 'やや売り',
  strong_sell: '売り',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: '低',
  medium: '普通',
  high: '高',
};

export const STOP_LOSS_METHOD_LABELS: Record<StopLossMethod, string> = {
  atr: 'ATR',
  atr_x2: 'ATR×2',
  recent_swing: '直近安値/高値',
  approx_support: '近似サポート/レジスタンス',
  donchian_lower: 'ドンチャン下限/上限',
  ma: '移動平均',
};

export const TAKE_PROFIT_METHOD_LABELS: Record<TakeProfitMethod, string> = {
  atr_multiple: 'ATR倍数',
  rr_target: 'RR目標',
  approx_resistance: '近似レジスタンス/サポート',
  fibonacci: 'フィボナッチ',
  donchian_upper: 'ドンチャン上限/下限',
  none: 'なし',
};
