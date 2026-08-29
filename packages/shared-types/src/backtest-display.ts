/**
 * バックテスト結果表示用の戦略ラベル・約定理由ヘルパ（v0.3.0 Ph6）。
 *
 * DB / Analysis は安定コードを持ち、UI はここ経由で日本語化する。
 */

import type {
  BacktestRunDto,
  BacktestRunListItemDto,
  MacdCrossParams,
  RsiThresholdParams,
  SignalStrategyParams,
  SignalStrategyType,
  SmaCrossParams,
  TrendScoreThresholdParams,
} from './signals';

/** Analysis / Nest が永続化する約定理由コード。 */
export type BacktestTradeReasonCode =
  | 'sma_golden_cross'
  | 'sma_dead_cross'
  | 'macd_golden_cross'
  | 'macd_dead_cross'
  | 'rsi_oversold'
  | 'rsi_overbought'
  | 'score_cross_up'
  | 'score_cross_down'
  | 'force_close_end'
  | 'atr_stop_loss';

const TRADE_REASON_LABELS: Record<BacktestTradeReasonCode, string> = {
  sma_golden_cross: 'SMAゴールデンクロス',
  sma_dead_cross: 'SMAデッドクロス',
  macd_golden_cross: 'MACDゴールデンクロス',
  macd_dead_cross: 'MACDデッドクロス',
  rsi_oversold: 'RSI売られすぎ',
  rsi_overbought: 'RSI買われすぎ',
  score_cross_up: 'スコア上昇クロス',
  score_cross_down: 'スコア下降クロス',
  force_close_end: '期間末強制決済',
  atr_stop_loss: 'ATRストップロス',
};

/**
 * 実行スナップショットから人間向け戦略ラベルを作る。
 * resolveSignalRule の label と同形式。
 */
export function formatStrategyTypeShortLabel(strategyType: SignalStrategyType): string {
  if (strategyType === 'smaCross') {
    return 'SMAクロス';
  }
  if (strategyType === 'macdCross') {
    return 'MACDクロス';
  }
  if (strategyType === 'trendScoreThreshold') {
    return 'トレンドスコア';
  }
  return 'RSI閾値';
}

/**
 * 実行スナップショットから人間向け戦略ラベルを作る。
 * resolveSignalRule の label と同形式。
 */
export function formatStrategyLabel(
  strategyType: SignalStrategyType,
  params: SignalStrategyParams,
): string {
  if (strategyType === 'smaCross') {
    const p = params as SmaCrossParams;
    return `SMAクロス ${p.shortPeriod}/${p.longPeriod}`;
  }
  if (strategyType === 'macdCross') {
    const p = params as MacdCrossParams;
    return `MACDクロス ${p.fast}/${p.slow}/${p.signal}`;
  }
  if (strategyType === 'trendScoreThreshold') {
    const p = params as TrendScoreThresholdParams;
    return `トレンドスコア（≥${p.buyThreshold} / ≤${p.sellThreshold}）`;
  }
  const p = params as RsiThresholdParams;
  return `RSI閾値 ${p.period}（≤${p.lower} / ≥${p.upper}）`;
}

/** 理由コードを日本語化する。null / 未知は空文字（UI は空欄）。
 * スコアがある判断（例: RSI）は「ラベル（値）」形式にする。
 */
export function formatTradeReason(
  code: string | null | undefined,
  score?: number | null,
): string {
  if (code == null || code === '') {
    return '';
  }
  if (!isBacktestTradeReasonCode(code)) {
    return '';
  }
  const label = TRADE_REASON_LABELS[code];
  if (score == null || !Number.isFinite(score)) {
    return label;
  }
  return `${label}（${formatDecisionScore(score)}）`;
}

/** 判断スコアの表示用丸め（RSI 等）。 */
export function formatDecisionScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** 詳細 DTO から一覧用 DTO へ変換する（実行直後のリスト更新用）。 */
export function backtestRunToListItem(run: BacktestRunDto): BacktestRunListItemDto {
  return {
    id: run.id,
    symbolId: run.symbolId,
    indicatorSetId: run.indicatorSetId,
    strategyType: run.strategyType,
    fromDate: run.fromDate,
    toDate: run.toDate,
    summary: run.summary,
    isActive: run.isActive,
    createdAt: run.createdAt,
  };
}

export function isBacktestTradeReasonCode(value: unknown): value is BacktestTradeReasonCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TRADE_REASON_LABELS, value);
}
