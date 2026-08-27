/**
 * 指標カタログ ID からバックテスト用シグナル戦略を導出する（v0.3.0 Ph3）。
 *
 * チャート分析で選んだ指標セットをシグナル正本とし、自由入力の戦略パラメータ UI を置き換える。
 * 売買に使わない指標（BB・一目など）は無視し、表示用としてセットに残してよい。
 */

import {
  INDICATOR_CATALOG_BY_ID,
  type IndicatorCatalogId,
} from './indicator-catalog';
import type {
  MacdCrossParams,
  RsiThresholdParams,
  SignalStrategyParams,
  SignalStrategyType,
  SmaCrossParams,
  TrendScoreThresholdParams,
} from './signals';

/** カタログに無い RSI 売買閾値。パラメータ自由編集 UI は設けない。 */
export const DEFAULT_RSI_SIGNAL_THRESHOLDS = {
  lower: 30,
  upper: 70,
} as const;

/**
 * トレンドスコア売買の既定閾値（ADR 007 状態ラベル境界）。
 * 買い: 「上昇トレンド」以上へクロス、売り: 「レンジだがやや下向き」以下へクロス。
 */
export const DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS = {
  buyThreshold: 37.5,
  sellThreshold: -42.5,
} as const;

/** SMA クロスの候補となるカタログ ID（短い period 順）。 */
export const SMA_SIGNAL_CATALOG_IDS = [
  'sma25',
  'sma75',
  'sma200',
] as const satisfies readonly IndicatorCatalogId[];

export type SmaSignalCatalogId = (typeof SMA_SIGNAL_CATALOG_IDS)[number];

/** カタログから導出された実行可能なシグナル規則。 */
export interface ResolvedSignalRule {
  strategyType: SignalStrategyType;
  params: SignalStrategyParams;
  /** 人間向けの短い説明（UI プレビュー用）。 */
  label: string;
}

/** カタログ SMA の short/long ペア（最適化・一覧用）。shortPeriod < longPeriod。 */
export interface CatalogSmaPair {
  shortId: SmaSignalCatalogId;
  longId: SmaSignalCatalogId;
  shortPeriod: number;
  longPeriod: number;
}

/**
 * 有効指標 ID から売買ルールを導出する。
 *
 * 優先順: SMA ちょうど 2 本 → macd → rsi。該当なしは null。
 */
export function resolveSignalRule(
  ids: readonly IndicatorCatalogId[] | ReadonlySet<IndicatorCatalogId>,
): ResolvedSignalRule | null {
  const enabled = toIdSet(ids);

  const smaIds = SMA_SIGNAL_CATALOG_IDS.filter((id) => enabled.has(id));
  if (smaIds.length === 2) {
    const a = smaIds[0] as SmaSignalCatalogId;
    const b = smaIds[1] as SmaSignalCatalogId;
    const first = catalogPeriod(a);
    const second = catalogPeriod(b);
    const shortPeriod = Math.min(first, second);
    const longPeriod = Math.max(first, second);
    const params: SmaCrossParams = { shortPeriod, longPeriod };
    return {
      strategyType: 'smaCross',
      params,
      label: `SMAクロス ${shortPeriod}/${longPeriod}`,
    };
  }

  if (enabled.has('macd')) {
    const raw = INDICATOR_CATALOG_BY_ID.macd.params;
    const params: MacdCrossParams = {
      fast: numberParam(raw, 'fast'),
      slow: numberParam(raw, 'slow'),
      signal: numberParam(raw, 'signal'),
    };
    return {
      strategyType: 'macdCross',
      params,
      label: `MACDクロス ${params.fast}/${params.slow}/${params.signal}`,
    };
  }

  if (enabled.has('rsi')) {
    const period = catalogPeriod('rsi');
    const params: RsiThresholdParams = {
      period,
      lower: DEFAULT_RSI_SIGNAL_THRESHOLDS.lower,
      upper: DEFAULT_RSI_SIGNAL_THRESHOLDS.upper,
    };
    return {
      strategyType: 'rsiThreshold',
      params,
      label: `RSI閾値 ${period}（≤${params.lower} / ≥${params.upper}）`,
    };
  }

  return null;
}

/**
 * シグナルとして実行可能か（resolveSignalRule が非 null）。
 */
export function isSignalCapableIndicatorIds(
  ids: readonly IndicatorCatalogId[] | ReadonlySet<IndicatorCatalogId>,
): boolean {
  return resolveSignalRule(ids) !== null;
}

/**
 * チャート同系のトレンドスコア閾値クロス規則を返す。
 * 閾値省略時は DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS。
 */
export function resolveTrendScoreSignalRule(
  thresholds: {
    buyThreshold?: number;
    sellThreshold?: number;
  } = {},
): ResolvedSignalRule {
  const buyThreshold =
    thresholds.buyThreshold ?? DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS.buyThreshold;
  const sellThreshold =
    thresholds.sellThreshold ?? DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS.sellThreshold;
  const params: TrendScoreThresholdParams = { buyThreshold, sellThreshold };
  return {
    strategyType: 'trendScoreThreshold',
    params,
    label: `トレンドスコア（≥${buyThreshold} / ≤${sellThreshold}）`,
  };
}

/**
 * カタログ SMA の全ペア（25/75, 25/200, 75/200）。最適化はこれのみ。
 */
export function listCatalogSmaPairs(): CatalogSmaPair[] {
  const periods: Array<{ id: SmaSignalCatalogId; period: number }> =
    SMA_SIGNAL_CATALOG_IDS.map((id) => ({
      id,
      period: catalogPeriod(id),
    }));
  const pairs: CatalogSmaPair[] = [];
  for (let i = 0; i < periods.length; i += 1) {
    for (let j = i + 1; j < periods.length; j += 1) {
      const left = periods[i]!;
      const right = periods[j]!;
      pairs.push({
        shortId: left.id,
        longId: right.id,
        shortPeriod: left.period,
        longPeriod: right.period,
      });
    }
  }
  return pairs;
}

/**
 * 導出結果の説明文。未確定時は理由付きメッセージ。
 */
export function describeSignalRule(
  ids: readonly IndicatorCatalogId[] | ReadonlySet<IndicatorCatalogId>,
): string {
  const rule = resolveSignalRule(ids);
  if (rule) {
    return `バックテスト用: ${rule.label}`;
  }

  const enabled = toIdSet(ids);
  const smaCount = SMA_SIGNAL_CATALOG_IDS.filter((id) => enabled.has(id)).length;
  if (smaCount === 1 || smaCount >= 3) {
    return '未確定: SMA（25/75/200）をちょうど 2 本選んでください';
  }
  return '未確定: SMA を 2 本、または MACD / RSI を有効にしてください';
}

function toIdSet(
  ids: readonly IndicatorCatalogId[] | ReadonlySet<IndicatorCatalogId>,
): ReadonlySet<IndicatorCatalogId> {
  return ids instanceof Set ? ids : new Set(ids);
}

function catalogPeriod(id: SmaSignalCatalogId | 'rsi'): number {
  return numberParam(INDICATOR_CATALOG_BY_ID[id].params, 'period');
}

function numberParam(params: Record<string, number>, key: string): number {
  const value = params[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Indicator catalog missing numeric param "${key}"`);
  }
  return value;
}
