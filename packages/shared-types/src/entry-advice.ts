import type {
  BacktestScoreBreakdown,
  MacdCrossParams,
  RsiThresholdParams,
  SmaCrossParams,
  TrendScoreThresholdParams,
} from './signals';
import type { IndicatorCatalogId } from './indicator-catalog';
import type { IndicatorParamOverrides } from './indicator-param-rules';
import {
  resolveSignalRule,
  resolveTrendScoreSignalRule,
  type ResolvedSignalRule,
} from './signal-from-catalog';

/** 基準日時点のエントリー状態。 */
export type EntryTiming = 'in_position' | 'entry_now' | 'wait' | 'no_rule';

/** 想定売買方向。 */
export type EntryDirection = 'long' | 'short';

/** 建玉スナップショット（シグナル履歴から推定）。 */
export interface EntryAdvicePositionDto {
  entryDate: string;
  entryPrice: number;
  units: number;
  isLong: boolean;
}

/** MM 助言（サイジング・ストップ）。 */
export interface EntryAdviceMmDto {
  atr: number | null;
  riskRate: number | null;
  unitQuantity: number | null;
  stopPrice: number | null;
}

/** ピラミッド追加水準。 */
export interface EntryAdvicePyramidLevelDto {
  unitIndex: number;
  price: number;
  reached: boolean;
}

/** 予測エントリー（参考値）。 */
export interface EntryAdvicePredictedEntryDto {
  triggerDate: string | null;
  triggerPrice: number | null;
  direction: EntryDirection;
  basis: string;
  note: string;
}

/** 基準日で新規エントリーした場合の MM 助言（フラット時の参考）。 */
export interface EntryAdviceNewEntryDto {
  entryPrice: number;
  isLong: boolean;
  mm: EntryAdviceMmDto | null;
  pyramidLevels: EntryAdvicePyramidLevelDto[] | null;
}

/** エントリー助言レスポンス。 */
export interface EntryAdviceDto {
  symbolId: string;
  baseDate: string;
  entryTiming: EntryTiming;
  direction: EntryDirection | null;
  signalActive: boolean;
  signalLabel: string;
  noRuleReason: string | null;
  position: EntryAdvicePositionDto | null;
  mm: EntryAdviceMmDto | null;
  pyramidLevels: EntryAdvicePyramidLevelDto[] | null;
  predictedEntry: EntryAdvicePredictedEntryDto | null;
  /** 基準日の総合スコア（トレンドスコア戦略時）。 */
  scoreAtBase: number | null;
  buyThreshold: number | null;
  sellThreshold: number | null;
  scoreBreakdown: BacktestScoreBreakdown | null;
  /** 判断根拠の要約（スコア・閾値・指標寄与）。 */
  rationale: string | null;
  /** 買い/売りシグナル理由コード（バックテストと同系）。 */
  entryReasonCode: string | null;
  /** 基準日価格で新規エントリーした場合の MM 水準（wait 等）。 */
  newEntryFromBase: EntryAdviceNewEntryDto | null;
}

export function isEntryTiming(value: unknown): value is EntryTiming {
  return (
    value === 'in_position' ||
    value === 'entry_now' ||
    value === 'wait' ||
    value === 'no_rule'
  );
}

export function isEntryDirection(value: unknown): value is EntryDirection {
  return value === 'long' || value === 'short';
}

function isEntryAdvicePositionDto(value: unknown): value is EntryAdvicePositionDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.entryDate === 'string' &&
    typeof r.entryPrice === 'number' &&
    typeof r.units === 'number' &&
    typeof r.isLong === 'boolean'
  );
}

function isEntryAdviceMmDto(value: unknown): value is EntryAdviceMmDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    (r.atr === null || typeof r.atr === 'number') &&
    (r.riskRate === null || typeof r.riskRate === 'number') &&
    (r.unitQuantity === null || typeof r.unitQuantity === 'number') &&
    (r.stopPrice === null || typeof r.stopPrice === 'number')
  );
}

function isEntryAdvicePyramidLevelDto(value: unknown): value is EntryAdvicePyramidLevelDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.unitIndex === 'number' &&
    typeof r.price === 'number' &&
    typeof r.reached === 'boolean'
  );
}

function isEntryAdvicePredictedEntryDto(value: unknown): value is EntryAdvicePredictedEntryDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    (r.triggerDate === null || typeof r.triggerDate === 'string') &&
    (r.triggerPrice === null || typeof r.triggerPrice === 'number') &&
    isEntryDirection(r.direction) &&
    typeof r.basis === 'string' &&
    typeof r.note === 'string'
  );
}

function isBacktestScoreBreakdown(value: unknown): value is BacktestScoreBreakdown {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return typeof r.groups === 'object' && r.groups !== null && typeof r.indicators === 'object' && r.indicators !== null;
}

function isEntryAdviceNewEntryDto(value: unknown): value is EntryAdviceNewEntryDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  return (
    typeof r.entryPrice === 'number' &&
    typeof r.isLong === 'boolean' &&
    (r.mm === null || isEntryAdviceMmDto(r.mm)) &&
    (r.pyramidLevels === null ||
      (Array.isArray(r.pyramidLevels) &&
        r.pyramidLevels.every((row) => isEntryAdvicePyramidLevelDto(row))))
  );
}

export function isEntryAdviceDto(value: unknown): value is EntryAdviceDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  if (
    typeof r.symbolId !== 'string' ||
    typeof r.baseDate !== 'string' ||
    !isEntryTiming(r.entryTiming) ||
    (r.direction !== null && !isEntryDirection(r.direction)) ||
    typeof r.signalActive !== 'boolean' ||
    typeof r.signalLabel !== 'string' ||
    (r.noRuleReason !== null && typeof r.noRuleReason !== 'string') ||
    (r.scoreAtBase != null && typeof r.scoreAtBase !== 'number') ||
    (r.buyThreshold != null && typeof r.buyThreshold !== 'number') ||
    (r.sellThreshold != null && typeof r.sellThreshold !== 'number') ||
    (r.rationale != null && typeof r.rationale !== 'string') ||
    (r.entryReasonCode != null && typeof r.entryReasonCode !== 'string')
  ) {
    return false;
  }
  if (r.position !== null && !isEntryAdvicePositionDto(r.position)) {
    return false;
  }
  if (r.mm !== null && !isEntryAdviceMmDto(r.mm)) {
    return false;
  }
  if (
    r.pyramidLevels !== null &&
    (!Array.isArray(r.pyramidLevels) ||
      !r.pyramidLevels.every((row) => isEntryAdvicePyramidLevelDto(row)))
  ) {
    return false;
  }
  if (
    r.predictedEntry !== null && !isEntryAdvicePredictedEntryDto(r.predictedEntry)
  ) {
    return false;
  }
  if (r.scoreBreakdown != null && !isBacktestScoreBreakdown(r.scoreBreakdown)) {
    return false;
  }
  if (r.newEntryFromBase != null && !isEntryAdviceNewEntryDto(r.newEntryFromBase)) {
    return false;
  }
  return true;
}

export function createEntryAdviceDto(input: EntryAdviceDto): EntryAdviceDto {
  return { ...input };
}

/** チャート価格線用の助言ライン。 */
export interface EntryAdvicePriceLineDto {
  price: number;
  color: string;
  title: string;
}

/** EntryAdviceDto からチャート描画用の価格線を組み立てる。 */
export function entryAdvicePriceLines(advice: EntryAdviceDto): EntryAdvicePriceLineDto[] {
  const lines: EntryAdvicePriceLineDto[] = [];
  if (advice.mm?.stopPrice != null) {
    lines.push({
      price: advice.mm.stopPrice,
      color: '#ef5350',
      title: 'ストップ',
    });
  }
  if (advice.pyramidLevels) {
    for (const level of advice.pyramidLevels) {
      if (!level.reached) {
        lines.push({
          price: level.price,
          color: '#42a5f5',
          title: `追加 U${level.unitIndex}`,
        });
      }
    }
  }
  if (advice.predictedEntry?.triggerPrice != null) {
    lines.push({
      price: advice.predictedEntry.triggerPrice,
      color: '#ffca28',
      title: '予測エントリー',
    });
  }
  if (advice.newEntryFromBase) {
    if (advice.newEntryFromBase.mm?.stopPrice != null) {
      lines.push({
        price: advice.newEntryFromBase.mm.stopPrice,
        color: '#ef5350',
        title: '新規ストップ',
      });
    }
    if (advice.newEntryFromBase.pyramidLevels) {
      for (const level of advice.newEntryFromBase.pyramidLevels) {
        if (!level.reached) {
          lines.push({
            price: level.price,
            color: '#42a5f5',
            title: `新規追加 U${level.unitIndex}`,
          });
        }
      }
    }
  }
  return lines;
}

/** チャート画面用: 指標からシグナル規則を解決（未確定時はトレンドスコア閾値）。 */
export function resolveChartSignalRule(
  ids: readonly IndicatorCatalogId[],
  paramOverrides?: IndicatorParamOverrides | null,
  thresholds?: { buyThreshold?: number; sellThreshold?: number },
): ResolvedSignalRule {
  const catalogRule = resolveSignalRule(ids, paramOverrides);
  if (catalogRule) {
    return catalogRule;
  }
  return resolveTrendScoreSignalRule(thresholds ?? {});
}

/** Analysis API の SignalSpec JSON へ変換する。 */
export function resolvedRuleToAnalysisSignal(
  rule: ResolvedSignalRule,
): Record<string, unknown> {
  const { strategyType, params } = rule;
  if (strategyType === 'trendScoreThreshold') {
    const p = params as TrendScoreThresholdParams;
    return {
      strategyType,
      buyThreshold: p.buyThreshold,
      sellThreshold: p.sellThreshold,
    };
  }
  if (strategyType === 'smaCross') {
    const p = params as SmaCrossParams;
    return {
      strategyType,
      shortPeriod: p.shortPeriod,
      longPeriod: p.longPeriod,
    };
  }
  if (strategyType === 'rsiThreshold') {
    const p = params as RsiThresholdParams;
    return {
      strategyType,
      period: p.period,
      lower: p.lower,
      upper: p.upper,
    };
  }
  const p = params as MacdCrossParams;
  return {
    strategyType,
    fast: p.fast,
    slow: p.slow,
    signal: p.signal,
  };
}
