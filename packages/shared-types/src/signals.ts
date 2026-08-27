/**
 * Signals / Backtest API の共有 DTO。
 *
 * 戦略定義 CRUD とバックテスト実行結果を web / api 間で同一契約で扱う。
 */

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
}

export interface BacktestEquityPointDto {
  id: string;
  backtestRunId: string;
  date: string;
  cash: number;
  positionValue: number;
  equity: number;
  drawdownRate: number;
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
  feeRate: number;
  slippageRate: number;
  summary: BacktestSummaryDto;
  trades: BacktestTradeDto[];
  equityPoints: BacktestEquityPointDto[];
  createdAt: string;
  updatedAt: string;
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
  feeRate: number;
  slippageRate: number;
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
  return (
    typeof record.finalEquity === 'number' &&
    typeof record.totalReturnRate === 'number' &&
    typeof record.maxDrawdownRate === 'number' &&
    typeof record.totalTrades === 'number' &&
    typeof record.winRate === 'number' &&
    typeof record.sharpeRatio === 'number' &&
    typeof record.profitFactor === 'number' &&
    typeof record.buyHoldReturnRate === 'number' &&
    typeof record.buyHoldFinalEquity === 'number'
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
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string' &&
    Array.isArray(record.trades) &&
    Array.isArray(record.equityPoints) &&
    isBacktestSummaryDto(record.summary)
  );
}
