/**
 * Signals / Backtest API の共有 DTO。
 *
 * 戦略定義 CRUD とバックテスト実行結果を web / api 間で同一契約で扱う。
 */

import type { FeeMode, MoneyManagementConfig, MoneyManagementStats, TradeSidePolicy } from './money-management';
import { isFeeMode, isMoneyManagementConfig, isMoneyManagementStats, isTradeSidePolicy } from './money-management';

export type SignalStrategyType =
  | 'smaCross'
  | 'rsiThreshold'
  | 'macdCross'
  | 'trendScoreThreshold';
export type TradeSide = 'buy' | 'sell';

/** バックテストの売買判断ソース。省略時は indicatorSet（既存互換）。 */
export type BacktestSignalMode = 'indicatorSet' | 'trendScore';

export interface SmaCrossParams {
  shortPeriod: number;
  longPeriod: number;
}

export interface RsiThresholdParams {
  period: number;
  lower: number;
  upper: number;
}

export interface MacdCrossParams {
  fast: number;
  slow: number;
  signal: number;
}

/**
 * チャート分析と同系のトレンドスコアによる閾値クロス。
 * buyThreshold / sellThreshold は -100〜+100。既定は状態ラベル境界（上昇 / やや下向き）。
 */
export interface TrendScoreThresholdParams {
  buyThreshold: number;
  sellThreshold: number;
}

export type SignalStrategyParams =
  | SmaCrossParams
  | RsiThresholdParams
  | MacdCrossParams
  | TrendScoreThresholdParams;

export interface SignalDefinitionDto {
  id: string;
  userId: string;
  name: string;
  description?: string;
  strategyType: SignalStrategyType;
  params: SignalStrategyParams;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * トレンドスコア約定時点の内訳（グループ寄与 + 指標点）。
 * date は約定日と別フィールドにあるため含めない。
 */
export interface BacktestScoreBreakdown {
  groups: Record<string, number | null>;
  indicators: Record<string, number | null>;
}

export interface BacktestTradeDto {
  id: string;
  backtestRunId: string;
  symbolId: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: TradeSide;
  grossPnl: number;
  feeAmount: number;
  slippageAmount: number;
  netPnl: number;
  /** 買い判断コード。既存 Run は null（UI は空欄）。 */
  entryReason: string | null;
  /** 売り判断コード。既存 Run は null（UI は空欄）。 */
  exitReason: string | null;
  /**
   * 買い判断に使ったスコア（例: RSI 値）。
   * クロス戦略などスコア非採用時・既存 Run は null。
   */
  entryScore: number | null;
  /**
   * 売り判断に使ったスコア（例: RSI 値）。
   * 期間末強制決済・クロス戦略・既存 Run は null。
   */
  exitScore: number | null;
  /** 買い時点のトレンドスコア内訳。RSI/クロス・既存 Run は null。 */
  entryScoreBreakdown: BacktestScoreBreakdown | null;
  /** 売り時点のトレンドスコア内訳。強制決済・非トレンド・既存 Run は null。 */
  exitScoreBreakdown: BacktestScoreBreakdown | null;
  /** エントリー時 ATR。MM 未使用・既存は null / 省略。 */
  atr?: number | null;
  /** エントリー時 N（タートルズ）。MM 未使用・既存は null / 省略。 */
  n?: number | null;
  /** 適用した実効リスク率。MM 未使用・既存は null / 省略。 */
  riskRate?: number | null;
  /** 初回エントリー数量。MM 未使用・既存は null / 省略。 */
  initialQuantity?: number | null;
  /** ピラミッド追加回数（初回除く）。MM 未使用・既存は null / 省略。 */
  addCount?: number | null;
  /** 決済時点のストップ価格。MM 未使用・既存は null / 省略。 */
  stopPrice?: number | null;
  /** 決済時点の保有ユニット数。MM 未使用・既存は null / 省略。 */
  unitCount?: number | null;
}

export interface BacktestEquityPointDto {
  id: string;
  backtestRunId: string;
  date: string;
  cash: number;
  positionValue: number;
  equity: number;
  drawdownRate: number;
  /** その日の判断スコア（RSI / 総合トレンドスコア）。非スコア戦略・既存は null。 */
  decisionScore: number | null;
  /** その日のトレンドスコア内訳。RSI/非トレンド・既存は null。 */
  scoreBreakdown: BacktestScoreBreakdown | null;
}

export interface BacktestSummaryDto {
  finalEquity: number;
  totalReturnRate: number;
  maxDrawdownRate: number;
  totalTrades: number;
  winRate: number;
  /** 日次エクイティ収益率の年率シャープ（リスクフリー 0） */
  sharpeRatio: number;
  /** 勝ち純損益合計 / |負け合計|。負け 0 かつ勝ちありなら勝ち合計 */
  profitFactor: number;
  buyHoldReturnRate: number;
  buyHoldFinalEquity: number;
  /** 資金管理統計。MM OFF・既存 Run は null / 省略可。 */
  moneyManagement?: MoneyManagementStats | null;
}

export interface BacktestRunDto {
  id: string;
  userId: string;
  /** 新規実行は指標セット起点。過去ラン互換のため null 可。 */
  indicatorSetId: string | null;
  /** 過去ラン互換。新規は null（戦略は strategyType/params スナップショットを参照）。 */
  signalDefinitionId: string | null;
  /** 実行時に resolveSignalRule した結果のスナップショット */
  strategyType: SignalStrategyType;
  params: SignalStrategyParams;
  symbolId: string;
  fromDate: string;
  toDate: string;
  initialCash: number;
  /** 手数料モード。既存 Run 互換のため省略可（省略時 rate）。 */
  feeMode?: FeeMode;
  feeRate: number;
  /** 固定手数料（銘柄通貨）。feeMode=fixed で使用。既存は 0 / 省略。 */
  feeFixed?: number;
  slippageRate: number;
  /** 売買方針。既存 Run 互換のため省略可（省略時 longOnly）。 */
  tradeSidePolicy?: TradeSidePolicy;
  /** 資金管理設定スナップショット。OFF / 既存は null / 省略。 */
  moneyManagement?: MoneyManagementConfig | null;
  summary: BacktestSummaryDto;
  trades: BacktestTradeDto[];
  equityPoints: BacktestEquityPointDto[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 実行履歴一覧・検索用の軽量 DTO（trades / equityPoints 不含）。 */
export interface BacktestRunListItemDto {
  id: string;
  symbolId: string;
  indicatorSetId: string | null;
  strategyType: SignalStrategyType;
  fromDate: string;
  toDate: string;
  summary: BacktestSummaryDto;
  isActive: boolean;
  createdAt: string;
}

/** GET/DELETE /backtests の検索クエリ（API と UI 共通）。 */
export interface BacktestRunSearchQuery {
  symbolId?: string;
  strategyType?: SignalStrategyType;
  indicatorSetId?: string;
  /** 検証期間フィルタ（Run 期間との overlap 判定） */
  fromDate?: string;
  toDate?: string;
  /** 実行日時フィルタ */
  createdFrom?: string;
  createdTo?: string;
  /** 省略時 true（活動中のみ）。false=削除済みのみ。all=両方。 */
  isActive?: boolean | 'all';
}

export interface DeleteBacktestRunsResponse {
  deletedCount: number;
}

export interface CreateSignalDefinitionRequest {
  name: string;
  description?: string;
  strategyType: SignalStrategyType;
  params: SignalStrategyParams;
  isActive?: boolean;
}

export interface UpdateSignalDefinitionRequest {
  name?: string;
  description?: string;
  params?: SignalStrategyParams;
  isActive?: boolean;
}

export interface RunBacktestRequest {
  /**
   * 売買判断のソース。
   * - `indicatorSet`: 指標セットから SMA/MACD/RSI を導出（従来）
   * - `trendScore`: チャートと同系の固定採点セットでスコア閾値クロス
   * 省略時は `indicatorSet`。
   */
  signalMode?: BacktestSignalMode;
  /**
   * 指標セット ID。
   * `signalMode=indicatorSet` では必須。
   * `trendScore` では結果チャートのオーバーレイ用に任意（売買には使わない）。
   */
  indicatorSetId?: string;
  symbolId: string;
  from: string;
  to: string;
  initialCash: number;
  /** 省略時 rate。 */
  feeMode?: FeeMode;
  feeRate: number;
  /** 固定手数料。省略時 0。 */
  feeFixed?: number;
  slippageRate: number;
  /** 省略時 longOnly。 */
  tradeSidePolicy?: TradeSidePolicy;
  /** 省略または enabled=false で従来パス。 */
  moneyManagement?: MoneyManagementConfig | null;
  /** `trendScore` 時のみ。省略時は DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS。 */
  buyThreshold?: number;
  /** `trendScore` 時のみ。省略時は DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS。 */
  sellThreshold?: number;
}

export interface ComputeSignalRequest {
  strategyType: SignalStrategyType;
  params: SignalStrategyParams;
  bars: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

export interface SignalPoint {
  date: string;
  buy: boolean;
  sell: boolean;
}

export interface ComputeSignalResponse {
  points: SignalPoint[];
}

export interface ComputeBacktestRequest extends ComputeSignalRequest {
  initialCash: number;
  feeRate: number;
  slippageRate: number;
  feeMode?: FeeMode;
  feeFixed?: number;
  tradeSidePolicy?: TradeSidePolicy;
  moneyManagement?: MoneyManagementConfig | null;
}

export interface ComputeBacktestResponse {
  summary: BacktestSummaryDto;
  trades: Array<Omit<BacktestTradeDto, 'id' | 'backtestRunId'>>;
  equityPoints: Array<Omit<BacktestEquityPointDto, 'id' | 'backtestRunId'>>;
}

/** カタログ SMA ペア（25/75, 25/200, 75/200）のみを評価する。期間レンジ指定は廃止。 */
export interface OptimizeBacktestRequest {
  symbolId: string;
  from: string;
  to: string;
  initialCash: number;
  feeRate: number;
  slippageRate: number;
  feeMode?: FeeMode;
  feeFixed?: number;
  tradeSidePolicy?: TradeSidePolicy;
  moneyManagement?: MoneyManagementConfig | null;
}

export interface OptimizeBacktestResultItem {
  shortPeriod: number;
  longPeriod: number;
  summary: BacktestSummaryDto;
}

export interface OptimizeBacktestResponse {
  results: OptimizeBacktestResultItem[];
}

export function isBacktestSummaryDto(value: unknown): value is BacktestSummaryDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  const mmStatsOk =
    record.moneyManagement === undefined ||
    record.moneyManagement === null ||
    isMoneyManagementStats(record.moneyManagement);
  return (
    typeof record.finalEquity === 'number' &&
    typeof record.totalReturnRate === 'number' &&
    typeof record.maxDrawdownRate === 'number' &&
    typeof record.totalTrades === 'number' &&
    typeof record.winRate === 'number' &&
    typeof record.sharpeRatio === 'number' &&
    typeof record.profitFactor === 'number' &&
    typeof record.buyHoldReturnRate === 'number' &&
    typeof record.buyHoldFinalEquity === 'number' &&
    mmStatsOk
  );
}

export function isOptimizeBacktestResponse(value: unknown): value is OptimizeBacktestResponse {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.results)) {
    return false;
  }
  return record.results.every((item) => {
    if (item === null || typeof item !== 'object') {
      return false;
    }
    const row = item as Record<string, unknown>;
    return (
      typeof row.shortPeriod === 'number' &&
      typeof row.longPeriod === 'number' &&
      isBacktestSummaryDto(row.summary)
    );
  });
}

export function isSignalStrategyType(value: unknown): value is SignalStrategyType {
  return (
    value === 'smaCross' ||
    value === 'rsiThreshold' ||
    value === 'macdCross' ||
    value === 'trendScoreThreshold'
  );
}

export function isBacktestSignalMode(value: unknown): value is BacktestSignalMode {
  return value === 'indicatorSet' || value === 'trendScore';
}

export function isSignalDefinitionDto(value: unknown): value is SignalDefinitionDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.userId === 'string' &&
    typeof record.name === 'string' &&
    isSignalStrategyType(record.strategyType) &&
    typeof record.isActive === 'boolean' &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
}

export function isBacktestRunDto(value: unknown): value is BacktestRunDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  const indicatorSetOk =
    record.indicatorSetId === null || typeof record.indicatorSetId === 'string';
  const signalDefinitionOk =
    record.signalDefinitionId === null || typeof record.signalDefinitionId === 'string';
  const mmOk =
    record.moneyManagement === null ||
    record.moneyManagement === undefined ||
    isMoneyManagementConfig(record.moneyManagement);
  const feeModeOk = record.feeMode === undefined || isFeeMode(record.feeMode);
  const policyOk =
    record.tradeSidePolicy === undefined || isTradeSidePolicy(record.tradeSidePolicy);
  const feeFixedOk = record.feeFixed === undefined || typeof record.feeFixed === 'number';
  return (
    typeof record.id === 'string' &&
    typeof record.userId === 'string' &&
    indicatorSetOk &&
    signalDefinitionOk &&
    isSignalStrategyType(record.strategyType) &&
    typeof record.symbolId === 'string' &&
    typeof record.fromDate === 'string' &&
    typeof record.toDate === 'string' &&
    typeof record.initialCash === 'number' &&
    typeof record.feeRate === 'number' &&
    typeof record.slippageRate === 'number' &&
    feeModeOk &&
    feeFixedOk &&
    policyOk &&
    mmOk &&
    typeof record.isActive === 'boolean' &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string' &&
    Array.isArray(record.trades) &&
    Array.isArray(record.equityPoints) &&
    isBacktestSummaryDto(record.summary)
  );
}

export function isBacktestRunListItemDto(value: unknown): value is BacktestRunListItemDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  const indicatorSetOk =
    record.indicatorSetId === null || typeof record.indicatorSetId === 'string';
  return (
    typeof record.id === 'string' &&
    typeof record.symbolId === 'string' &&
    indicatorSetOk &&
    isSignalStrategyType(record.strategyType) &&
    typeof record.fromDate === 'string' &&
    typeof record.toDate === 'string' &&
    typeof record.isActive === 'boolean' &&
    typeof record.createdAt === 'string' &&
    isBacktestSummaryDto(record.summary)
  );
}

export function isDeleteBacktestRunsResponse(value: unknown): value is DeleteBacktestRunsResponse {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.deletedCount === 'number';
}
