/**
 * Signals / Backtest のビジネスロジック。
 *
 * - シグナル定義 CRUD（ユーザー所有）
 * - analysis へのバックテスト実行委譲
 * - 実行結果の永続化と再取得
 */
import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  API_ERROR_CODES,
  type BacktestRunDto,
  type ComputeBacktestResponse,
  type ComputeSignalRequest,
  type CreateSignalDefinitionRequest,
  type RunBacktestRequest,
  type SignalStrategyParams,
  type SignalDefinitionDto,
  type SignalStrategyType,
  type TradeSide,
} from '@market/shared-types';
import { PricesService } from '../prices/prices.service';
import { PrismaService } from '../prisma.service';
import type {
  CreateSignalDefinitionDto,
  RunBacktestDto,
  UpdateSignalDefinitionDto,
} from './signals-backtests.dto';

type DecimalLike = number | string | { toString(): string };

type SignalDefinitionRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  strategyType: 'SMA_CROSS' | 'RSI_THRESHOLD' | 'MACD_CROSS';
  paramsJson: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class SignalsBacktestsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly pricesService: PricesService,
  ) {}

  async listSignalDefinitions(userId: string): Promise<SignalDefinitionDto[]> {
    const rows = await this.prismaService.prisma.signalDefinition.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toSignalDefinitionDto(row));
  }

  async getSignalDefinition(userId: string, id: string): Promise<SignalDefinitionDto> {
    const row = await this.prismaService.prisma.signalDefinition.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException({
        code: API_ERROR_CODES.SIGNAL_DEFINITION_NOT_FOUND,
        message: 'Signal definition not found',
      });
    }
    return this.toSignalDefinitionDto(row);
  }

  async createSignalDefinition(
    userId: string,
    dto: CreateSignalDefinitionDto,
  ): Promise<SignalDefinitionDto> {
    const normalized = this.toCreateSignalDefinitionRequest(dto);
    const existing = await this.prismaService.prisma.signalDefinition.findFirst({
      where: { userId, name: normalized.name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: API_ERROR_CODES.SIGNAL_DEFINITION_ALREADY_EXISTS,
        message: 'Signal definition name already exists',
      });
    }
    const row = await this.prismaService.prisma.signalDefinition.create({
      data: {
        userId,
        name: normalized.name,
        description: normalized.description ?? null,
        strategyType: this.toPrismaStrategyType(normalized.strategyType),
        paramsJson: normalized.params as object,
        isActive: normalized.isActive ?? true,
      },
    });
    return this.toSignalDefinitionDto(row);
  }

  async updateSignalDefinition(
    userId: string,
    id: string,
    dto: UpdateSignalDefinitionDto,
  ): Promise<SignalDefinitionDto> {
    await this.getSignalDefinition(userId, id);
    const row = await this.prismaService.prisma.signalDefinition.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        paramsJson: dto.params as object | undefined,
        isActive: dto.isActive,
      },
    });
    return this.toSignalDefinitionDto(row);
  }

  async removeSignalDefinition(userId: string, id: string): Promise<void> {
    await this.getSignalDefinition(userId, id);
    await this.prismaService.prisma.signalDefinition.delete({ where: { id } });
  }

  async listBacktestRuns(userId: string): Promise<BacktestRunDto[]> {
    const rows = await this.prismaService.prisma.backtestRun.findMany({
      where: { userId },
      include: { trades: true, equityPoints: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toBacktestRunDto(row));
  }

  async getBacktestRun(userId: string, id: string): Promise<BacktestRunDto> {
    const row = await this.prismaService.prisma.backtestRun.findFirst({
      where: { id, userId },
      include: { trades: true, equityPoints: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: API_ERROR_CODES.BACKTEST_RUN_NOT_FOUND,
        message: 'Backtest run not found',
      });
    }
    return this.toBacktestRunDto(row);
  }

  async runBacktest(userId: string, dto: RunBacktestDto): Promise<BacktestRunDto> {
    const signal = await this.getSignalDefinition(userId, dto.signalDefinitionId);
    const runRequest: RunBacktestRequest = {
      signalDefinitionId: dto.signalDefinitionId,
      symbolId: dto.symbolId,
      from: dto.from,
      to: dto.to,
      initialCash: dto.initialCash,
      feeRate: dto.feeRate,
      slippageRate: dto.slippageRate,
    };
    const analysisRequest = await this.buildComputeBacktestRequest(signal, runRequest);
    const result = await this.callAnalysisBacktest(analysisRequest);
    const created = await this.prismaService.prisma.backtestRun.create({
      data: {
        userId,
        signalDefinitionId: signal.id,
        symbolId: dto.symbolId,
        fromDate: new Date(dto.from),
        toDate: new Date(dto.to),
        initialCash: dto.initialCash,
        feeRate: dto.feeRate,
        slippageRate: dto.slippageRate,
        finalEquity: result.summary.finalEquity,
        totalReturnRate: result.summary.totalReturnRate,
        maxDrawdownRate: result.summary.maxDrawdownRate,
        totalTrades: result.summary.totalTrades,
        winRate: result.summary.winRate,
        trades: {
          create: result.trades.map((trade) => ({
            symbolId: dto.symbolId,
            entryDate: new Date(trade.entryDate),
            exitDate: new Date(trade.exitDate),
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            quantity: trade.quantity,
            side: this.toPrismaTradeSide(trade.side),
            grossPnl: trade.grossPnl,
            feeAmount: trade.feeAmount,
            slippageAmount: trade.slippageAmount,
            netPnl: trade.netPnl,
          })),
        },
        equityPoints: {
          create: result.equityPoints.map((point) => ({
            date: new Date(point.date),
            cash: point.cash,
            positionValue: point.positionValue,
            equity: point.equity,
            drawdownRate: point.drawdownRate,
          })),
        },
      },
      include: { trades: true, equityPoints: true },
    });
    return this.toBacktestRunDto(created);
  }

  private async buildComputeBacktestRequest(
    signal: SignalDefinitionDto,
    run: RunBacktestRequest,
  ): Promise<ComputeSignalRequest & {
    initialCash: number;
    feeRate: number;
    slippageRate: number;
    symbolId: string;
  }> {
    const prices = await this.pricesService.listBySymbolId(run.symbolId, {
      from: run.from,
      to: run.to,
    });
    return {
      strategyType: signal.strategyType,
      params: signal.params,
      bars: prices.map((price) => ({
        date: price.date,
        open: price.open,
        high: price.high,
        low: price.low,
        close: price.close,
        volume: price.volume,
      })),
      symbolId: run.symbolId,
      initialCash: run.initialCash,
      feeRate: run.feeRate,
      slippageRate: run.slippageRate,
    };
  }

  private async callAnalysisBacktest(
    body: ComputeSignalRequest & {
      initialCash: number;
      feeRate: number;
      slippageRate: number;
      symbolId: string;
    },
  ): Promise<ComputeBacktestResponse> {
    const analysisUrl = process.env.ANALYSIS_URL ?? 'http://localhost:8000';
    const signal = this.toAnalysisSignalSpec(body.strategyType, body.params);
    let response: Response;
    try {
      response = await fetch(`${analysisUrl}/backtests/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbolId: body.symbolId,
          bars: body.bars,
          signal,
          initialCash: body.initialCash,
          feeRate: body.feeRate,
          slippageRate: body.slippageRate,
        }),
      });
    } catch (error) {
      throw new BadGatewayException({
        code: API_ERROR_CODES.ANALYSIS_UPSTREAM_ERROR,
        message: 'Failed to reach analysis service',
        details: { error: error instanceof Error ? error.message : 'unknown' },
      });
    }
    if (!response.ok) {
      throw new BadGatewayException({
        code: API_ERROR_CODES.ANALYSIS_UPSTREAM_ERROR,
        message: 'Analysis service returned an error',
      });
    }
    return (await response.json()) as ComputeBacktestResponse;
  }

  private toSignalDefinitionDto(row: SignalDefinitionRow): SignalDefinitionDto {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description ?? undefined,
      strategyType: this.fromPrismaStrategyType(row.strategyType),
      params: row.paramsJson as SignalDefinitionDto['params'],
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toBacktestRunDto(
    row: {
      id: string;
      userId: string;
      signalDefinitionId: string;
      symbolId: string;
      fromDate: Date;
      toDate: Date;
      initialCash: DecimalLike;
      feeRate: DecimalLike;
      slippageRate: DecimalLike;
      finalEquity: DecimalLike;
      totalReturnRate: DecimalLike;
      maxDrawdownRate: DecimalLike;
      totalTrades: number;
      winRate: DecimalLike;
      createdAt: Date;
      updatedAt: Date;
      trades: Array<{
        id: string;
        backtestRunId: string;
        symbolId: string;
        entryDate: Date;
        exitDate: Date;
        entryPrice: DecimalLike;
        exitPrice: DecimalLike;
        quantity: DecimalLike;
        side: 'BUY' | 'SELL';
        grossPnl: DecimalLike;
        feeAmount: DecimalLike;
        slippageAmount: DecimalLike;
        netPnl: DecimalLike;
      }>;
      equityPoints: Array<{
        id: string;
        backtestRunId: string;
        date: Date;
        cash: DecimalLike;
        positionValue: DecimalLike;
        equity: DecimalLike;
        drawdownRate: DecimalLike;
      }>;
    },
  ): BacktestRunDto {
    return {
      id: row.id,
      userId: row.userId,
      signalDefinitionId: row.signalDefinitionId,
      symbolId: row.symbolId,
      fromDate: row.fromDate.toISOString().slice(0, 10),
      toDate: row.toDate.toISOString().slice(0, 10),
      initialCash: this.toNumber(row.initialCash),
      feeRate: this.toNumber(row.feeRate),
      slippageRate: this.toNumber(row.slippageRate),
      summary: {
        finalEquity: this.toNumber(row.finalEquity),
        totalReturnRate: this.toNumber(row.totalReturnRate),
        maxDrawdownRate: this.toNumber(row.maxDrawdownRate),
        totalTrades: row.totalTrades,
        winRate: this.toNumber(row.winRate),
      },
      trades: row.trades.map((trade) => ({
        id: trade.id,
        backtestRunId: trade.backtestRunId,
        symbolId: trade.symbolId,
        entryDate: trade.entryDate.toISOString().slice(0, 10),
        exitDate: trade.exitDate.toISOString().slice(0, 10),
        entryPrice: this.toNumber(trade.entryPrice),
        exitPrice: this.toNumber(trade.exitPrice),
        quantity: this.toNumber(trade.quantity),
        side: trade.side === 'BUY' ? 'buy' : 'sell',
        grossPnl: this.toNumber(trade.grossPnl),
        feeAmount: this.toNumber(trade.feeAmount),
        slippageAmount: this.toNumber(trade.slippageAmount),
        netPnl: this.toNumber(trade.netPnl),
      })),
      equityPoints: row.equityPoints.map((point) => ({
        id: point.id,
        backtestRunId: point.backtestRunId,
        date: point.date.toISOString().slice(0, 10),
        cash: this.toNumber(point.cash),
        positionValue: this.toNumber(point.positionValue),
        equity: this.toNumber(point.equity),
        drawdownRate: this.toNumber(point.drawdownRate),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toNumber(value: DecimalLike): number {
    return typeof value === 'number' ? value : Number(value.toString());
  }

  private fromPrismaStrategyType(value: SignalDefinitionRow['strategyType']): SignalStrategyType {
    if (value === 'SMA_CROSS') {
      return 'smaCross';
    }
    if (value === 'RSI_THRESHOLD') {
      return 'rsiThreshold';
    }
    return 'macdCross';
  }

  private toPrismaStrategyType(value: SignalStrategyType): SignalDefinitionRow['strategyType'] {
    if (value === 'smaCross') {
      return 'SMA_CROSS';
    }
    if (value === 'rsiThreshold') {
      return 'RSI_THRESHOLD';
    }
    return 'MACD_CROSS';
  }

  private toPrismaTradeSide(value: TradeSide): 'BUY' | 'SELL' {
    return value === 'buy' ? 'BUY' : 'SELL';
  }

  private toCreateSignalDefinitionRequest(
    dto: CreateSignalDefinitionDto,
  ): CreateSignalDefinitionRequest {
    return {
      name: dto.name.trim(),
      description: dto.description?.trim(),
      strategyType: dto.strategyType,
      params: dto.params as unknown as SignalStrategyParams,
      isActive: dto.isActive,
    };
  }

  private toAnalysisSignalSpec(
    strategyType: SignalStrategyType,
    params: SignalStrategyParams,
  ): Record<string, unknown> {
    if (strategyType === 'smaCross') {
      const smaParams = params as Extract<SignalStrategyParams, { shortPeriod: number }>;
      return {
        strategyType,
        shortPeriod: smaParams.shortPeriod,
        longPeriod: smaParams.longPeriod,
      };
    }
    if (strategyType === 'rsiThreshold') {
      const rsiParams = params as Extract<SignalStrategyParams, { period: number }>;
      return {
        strategyType,
        period: rsiParams.period,
        lower: rsiParams.lower,
        upper: rsiParams.upper,
      };
    }
    const macdParams = params as Extract<SignalStrategyParams, { fast: number }>;
    return {
      strategyType,
      fast: macdParams.fast,
      slow: macdParams.slow,
      signal: macdParams.signal,
    };
  }
}
