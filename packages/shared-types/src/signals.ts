/**
 * Signals / Backtest API の共有 DTO。
 *
 * 戦略定義 CRUD とバックテスト実行結果を web / api 間で同一契約で扱う。
 */

export type SignalStrategyType = 'smaCross' | 'rsiThreshold' | 'macdCross';
export type TradeSide = 'buy' | 'sell';

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

export type SignalStrategyParams = SmaCrossParams | RsiThresholdParams | MacdCrossParams;

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
}

export interface BacktestRunDto {
  id: string;
  userId: string;
  signalDefinitionId: string;
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
  signalDefinitionId: string;
  symbolId: string;
  from: string;
  to: string;
  initialCash: number;
  feeRate: number;
  slippageRate: number;
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

export function isSignalStrategyType(value: unknown): value is SignalStrategyType {
  return value === 'smaCross' || value === 'rsiThreshold' || value === 'macdCross';
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
  return (
    typeof record.id === 'string' &&
    typeof record.userId === 'string' &&
    typeof record.signalDefinitionId === 'string' &&
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
    record.summary !== null &&
    typeof record.summary === 'object'
  );
}
