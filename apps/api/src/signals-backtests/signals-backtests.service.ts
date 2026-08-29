/**
 * Signals / Backtest のビジネスロジック。
 *
 * - シグナル定義 CRUD（ユーザー所有）
 * - analysis へのバックテスト実行委譲
 * - 実行結果の永続化と再取得
 */
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  API_ERROR_CODES,
  computeIndicatorLookback,
  describeSignalRule,
  isIndicatorCatalogId,
  listCatalogSmaPairs,
  resolveSignalRule,
  resolveTrendScoreSignalRule,
  scoringCatalogIds,
  specsFromCatalogIds,
  type BacktestRunDto,
  type BacktestRunListItemDto,
  type BacktestRunSearchQuery,
  type BacktestScoreBreakdown,
  type ComputeBacktestResponse,
  type ComputeSignalRequest,
  type CreateSignalDefinitionRequest,
  type IndicatorCatalogId,
  type OptimizeBacktestResponse,
  type ResolvedSignalRule,
  type SignalStrategyParams,
  type SignalDefinitionDto,
  type SignalStrategyType,
  type TradeSide,
  type TrendScoreThresholdParams,
} from '@market/shared-types';
import { Prisma } from '@market/database';
import { PricesService } from '../prices/prices.service';
import { PrismaService } from '../prisma.service';
import type {
  BacktestRunSearchQueryDto,
  CreateSignalDefinitionDto,
  OptimizeBacktestDto,
  RunBacktestDto,
  UpdateSignalDefinitionDto,
} from './signals-backtests.dto';

type DecimalLike = number | string | { toString(): string };

type PrismaStrategyType =
  | 'SMA_CROSS'
  | 'RSI_THRESHOLD'
  | 'MACD_CROSS'
  | 'TREND_SCORE_THRESHOLD';

type SignalDefinitionRow = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  strategyType: PrismaStrategyType;
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

  async listBacktestRuns(
    userId: string,
    queryDto: BacktestRunSearchQueryDto = {},
  ): Promise<BacktestRunListItemDto[]> {
    const query = this.parseBacktestRunSearchQuery(queryDto);
    const rows = await this.prismaService.prisma.backtestRun.findMany({
      where: this.buildBacktestRunWhere(userId, query),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toBacktestRunListItemDto(row));
  }

  async removeBacktestRun(userId: string, id: string): Promise<void> {
    const row = await this.prismaService.prisma.backtestRun.findFirst({
      where: { id, userId, isActive: true },
    });
    if (!row) {
      throw new NotFoundException({
        code: API_ERROR_CODES.BACKTEST_RUN_NOT_FOUND,
        message: 'Backtest run not found',
      });
    }
    await this.prismaService.prisma.backtestRun.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async removeBacktestRuns(
    userId: string,
    queryDto: BacktestRunSearchQueryDto,
  ): Promise<{ deletedCount: number }> {
    const query = this.parseBacktestRunSearchQuery(queryDto);
    const where = {
      ...this.buildBacktestRunWhere(userId, query),
      isActive: true,
    };
    const result = await this.prismaService.prisma.backtestRun.updateMany({
      where,
      data: { isActive: false },
    });
    return { deletedCount: result.count };
  }

  /** HTTP クエリ DTO を共有型の検索条件へ正規化する。 */
  parseBacktestRunSearchQuery(dto: BacktestRunSearchQueryDto): BacktestRunSearchQuery {
    return {
      symbolId: dto.symbolId?.trim() || undefined,
      strategyType: dto.strategyType,
      indicatorSetId: dto.indicatorSetId?.trim() || undefined,
      fromDate: dto.fromDate?.trim() || undefined,
      toDate: dto.toDate?.trim() || undefined,
      createdFrom: dto.createdFrom?.trim() || undefined,
      createdTo: dto.createdTo?.trim() || undefined,
      isActive: this.parseBacktestRunIsActiveFilter(dto.isActive),
    };
  }

  /** isActive クエリ文字列を boolean | 'all' に変換。省略時 true。 */
  parseBacktestRunIsActiveFilter(value?: string): boolean | 'all' {
    if (value === undefined || value === '') {
      return true;
    }
    if (value === 'all') {
      return 'all';
    }
    if (value === 'false' || value === '0') {
      return false;
    }
    return true;
  }

  /** GET/DELETE 共通の Prisma where 条件。 */
  buildBacktestRunWhere(
    userId: string,
    query: BacktestRunSearchQuery,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = { userId };

    const isActive = query.isActive ?? true;
    if (isActive !== 'all') {
      where.isActive = isActive;
    }

    if (query.symbolId) {
      where.symbolId = query.symbolId;
    }
    if (query.indicatorSetId) {
      where.indicatorSetId = query.indicatorSetId;
    }
    if (query.strategyType) {
      where.strategyType = this.toPrismaStrategyType(query.strategyType);
    }

    // 検証期間 overlap: run.toDate >= filter.from AND run.fromDate <= filter.to
    if (query.fromDate || query.toDate) {
      const fromDateFilter: Record<string, Date> = {};
      const toDateFilter: Record<string, Date> = {};
      if (query.fromDate) {
        toDateFilter.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        fromDateFilter.lte = new Date(query.toDate);
      }
      if (Object.keys(fromDateFilter).length > 0) {
        where.fromDate = fromDateFilter;
      }
      if (Object.keys(toDateFilter).length > 0) {
        where.toDate = toDateFilter;
      }
    }

    if (query.createdFrom || query.createdTo) {
      const createdAt: Record<string, Date> = {};
      if (query.createdFrom) {
        createdAt.gte = new Date(query.createdFrom);
      }
      if (query.createdTo) {
        const end = new Date(query.createdTo);
        end.setUTCHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    return where;
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
    const signalMode = dto.signalMode ?? 'indicatorSet';

    if (signalMode === 'trendScore') {
      return this.runTrendScoreBacktest(userId, dto);
    }

    if (!dto.indicatorSetId) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'indicatorSetId is required when signalMode is indicatorSet',
      });
    }

    const indicatorSet = await this.prismaService.prisma.indicatorSet.findFirst({
      where: { id: dto.indicatorSetId, userId },
    });
    if (!indicatorSet) {
      throw new NotFoundException({
        code: API_ERROR_CODES.INDICATOR_SET_NOT_FOUND,
        message: 'Indicator set not found',
      });
    }

    const catalogIds = indicatorSet.indicatorIds.filter((id): id is IndicatorCatalogId =>
      isIndicatorCatalogId(id),
    );
    const paramOverrides = this.toParamOverrides(indicatorSet.indicatorParams);
    const rule = resolveSignalRule(catalogIds, paramOverrides);
    if (!rule) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: describeSignalRule(catalogIds),
      });
    }

    const analysisRequest = await this.buildComputeBacktestRequestFromRule(rule, {
      symbolId: dto.symbolId,
      from: dto.from,
      to: dto.to,
      initialCash: dto.initialCash,
      feeRate: dto.feeRate,
      slippageRate: dto.slippageRate,
    });
    const result = await this.callAnalysisBacktest(analysisRequest);
    return this.persistBacktestRun(userId, {
      indicatorSetId: indicatorSet.id,
      rule,
      dto,
      result,
    });
  }

  /**
   * チャート分析と同系のトレンドスコアで売買するバックテスト。
   * 指標セットは結果チャートのオーバーレイ用に任意（売買ルールには使わない）。
   */
  private async runTrendScoreBacktest(
    userId: string,
    dto: RunBacktestDto,
  ): Promise<BacktestRunDto> {
    if (
      dto.buyThreshold != null &&
      dto.sellThreshold != null &&
      dto.buyThreshold <= dto.sellThreshold
    ) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'buyThreshold must be greater than sellThreshold',
      });
    }

    let indicatorSetId: string | null = null;
    let indicatorSetThresholds: { buyThreshold: number | null; sellThreshold: number | null } | null =
      null;
    if (dto.indicatorSetId) {
      const indicatorSet = await this.prismaService.prisma.indicatorSet.findFirst({
        where: { id: dto.indicatorSetId, userId },
      });
      if (!indicatorSet) {
        throw new NotFoundException({
          code: API_ERROR_CODES.INDICATOR_SET_NOT_FOUND,
          message: 'Indicator set not found',
        });
      }
      indicatorSetId = indicatorSet.id;
      indicatorSetThresholds = {
        buyThreshold: indicatorSet.buyThreshold,
        sellThreshold: indicatorSet.sellThreshold,
      };
    }

    const rule = resolveTrendScoreSignalRule({
      buyThreshold: dto.buyThreshold ?? indicatorSetThresholds?.buyThreshold ?? undefined,
      sellThreshold: dto.sellThreshold ?? indicatorSetThresholds?.sellThreshold ?? undefined,
    });

    const analysisRequest = await this.buildComputeBacktestRequestTrendScore(rule, {
      symbolId: dto.symbolId,
      from: dto.from,
      to: dto.to,
      initialCash: dto.initialCash,
      feeRate: dto.feeRate,
      slippageRate: dto.slippageRate,
    });
    const result = await this.callAnalysisBacktest(analysisRequest);
    return this.persistBacktestRun(userId, {
      indicatorSetId,
      rule,
      dto,
      result,
    });
  }

  private async persistBacktestRun(
    userId: string,
    args: {
      indicatorSetId: string | null;
      rule: ResolvedSignalRule;
      dto: RunBacktestDto;
      result: ComputeBacktestResponse;
    },
  ): Promise<BacktestRunDto> {
    const { indicatorSetId, rule, dto, result } = args;
    const created = await this.prismaService.prisma.backtestRun.create({
      data: {
        userId,
        indicatorSetId,
        signalDefinitionId: null,
        strategyType: this.toPrismaStrategyType(rule.strategyType),
        paramsJson: rule.params as object,
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
        sharpeRatio: result.summary.sharpeRatio,
        profitFactor: result.summary.profitFactor,
        buyHoldReturnRate: result.summary.buyHoldReturnRate,
        buyHoldFinalEquity: result.summary.buyHoldFinalEquity,
        trades: {
          // UncheckedCreate（symbolId）を明示し、Json オブジェクトで relation create に寄らないようにする
          create: result.trades.map(
            (trade): Prisma.BacktestTradeUncheckedCreateWithoutBacktestRunInput => ({
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
              entryReason: trade.entryReason ?? null,
              exitReason: trade.exitReason ?? null,
              entryScore: trade.entryScore ?? null,
              exitScore: trade.exitScore ?? null,
              entryScoreBreakdown: (trade.entryScoreBreakdown ??
                null) as unknown as Prisma.InputJsonValue,
              exitScoreBreakdown: (trade.exitScoreBreakdown ??
                null) as unknown as Prisma.InputJsonValue,
            }),
          ),
        },
        equityPoints: {
          create: result.equityPoints.map((point) => ({
            date: new Date(point.date),
            cash: point.cash,
            positionValue: point.positionValue,
            equity: point.equity,
            drawdownRate: point.drawdownRate,
            decisionScore: point.decisionScore ?? null,
            scoreBreakdown: (point.scoreBreakdown ??
              null) as unknown as Prisma.InputJsonValue,
          })),
        },
      },
      include: { trades: true, equityPoints: true },
    });
    return this.toBacktestRunDto(created);
  }

  /**
   * カタログ SMA ペア（25/75, 25/200, 75/200）のみを評価する。結果は永続化しない。
   * userId は JWT 認証済みであることの確認用（所有データは触らない）。
   */
  async optimizeBacktest(
    _userId: string,
    dto: OptimizeBacktestDto,
  ): Promise<OptimizeBacktestResponse> {
    const prices = await this.pricesService.listBySymbolId(dto.symbolId, {
      from: dto.from,
      to: dto.to,
    });
    const bars = prices.map((price) => ({
      date: price.date,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      volume: price.volume,
    }));

    const results: OptimizeBacktestResponse['results'] = [];
    for (const pair of listCatalogSmaPairs()) {
      const result = await this.callAnalysisBacktest({
        strategyType: 'smaCross',
        params: { shortPeriod: pair.shortPeriod, longPeriod: pair.longPeriod },
        bars,
        symbolId: dto.symbolId,
        initialCash: dto.initialCash,
        feeRate: dto.feeRate,
        slippageRate: dto.slippageRate,
      });
      results.push({
        shortPeriod: pair.shortPeriod,
        longPeriod: pair.longPeriod,
        summary: result.summary,
      });
    }

    results.sort((a, b) => b.summary.totalReturnRate - a.summary.totalReturnRate);
    return { results };
  }

  private async buildComputeBacktestRequestFromRule(
    rule: ResolvedSignalRule,
    run: {
      symbolId: string;
      from: string;
      to: string;
      initialCash: number;
      feeRate: number;
      slippageRate: number;
    },
  ): Promise<
    ComputeSignalRequest & {
      initialCash: number;
      feeRate: number;
      slippageRate: number;
      symbolId: string;
      rangeStartIndex?: number;
    }
  > {
    const prices = await this.pricesService.listBySymbolId(run.symbolId, {
      from: run.from,
      to: run.to,
    });
    return {
      strategyType: rule.strategyType,
      params: rule.params,
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

  /**
   * トレンドスコア戦略用。チャートと同様 lookback 付き日足を渡し、表示期間から売買を開始する。
   */
  private async buildComputeBacktestRequestTrendScore(
    rule: ResolvedSignalRule,
    run: {
      symbolId: string;
      from: string;
      to: string;
      initialCash: number;
      feeRate: number;
      slippageRate: number;
    },
  ): Promise<
    ComputeSignalRequest & {
      initialCash: number;
      feeRate: number;
      slippageRate: number;
      symbolId: string;
      rangeStartIndex?: number;
    }
  > {
    const specs = specsFromCatalogIds(scoringCatalogIds());
    const lookback = computeIndicatorLookback(specs);
    const { bars, rangeStartIndex } = await this.pricesService.listWithLookback(run.symbolId, {
      from: run.from,
      to: run.to,
      lookback,
    });
    return {
      strategyType: rule.strategyType,
      params: rule.params,
      bars: bars.map((price) => ({
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
      rangeStartIndex,
    };
  }

  private async callAnalysisBacktest(
    body: ComputeSignalRequest & {
      initialCash: number;
      feeRate: number;
      slippageRate: number;
      symbolId: string;
      rangeStartIndex?: number;
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
          rangeStartIndex: body.rangeStartIndex ?? 0,
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

  private toBacktestRunListItemDto(row: {
    id: string;
    symbolId: string;
    indicatorSetId: string | null;
    strategyType: SignalDefinitionRow['strategyType'];
    fromDate: Date;
    toDate: Date;
    finalEquity: DecimalLike;
    totalReturnRate: DecimalLike;
    maxDrawdownRate: DecimalLike;
    totalTrades: number;
    winRate: DecimalLike;
    sharpeRatio: DecimalLike;
    profitFactor: DecimalLike;
    buyHoldReturnRate: DecimalLike;
    buyHoldFinalEquity: DecimalLike;
    isActive: boolean;
    createdAt: Date;
  }): BacktestRunListItemDto {
    return {
      id: row.id,
      symbolId: row.symbolId,
      indicatorSetId: row.indicatorSetId,
      strategyType: this.fromPrismaStrategyType(row.strategyType),
      fromDate: row.fromDate.toISOString().slice(0, 10),
      toDate: row.toDate.toISOString().slice(0, 10),
      summary: {
        finalEquity: this.toNumber(row.finalEquity),
        totalReturnRate: this.toNumber(row.totalReturnRate),
        maxDrawdownRate: this.toNumber(row.maxDrawdownRate),
        totalTrades: row.totalTrades,
        winRate: this.toNumber(row.winRate),
        sharpeRatio: this.toNumber(row.sharpeRatio),
        profitFactor: this.toNumber(row.profitFactor),
        buyHoldReturnRate: this.toNumber(row.buyHoldReturnRate),
        buyHoldFinalEquity: this.toNumber(row.buyHoldFinalEquity),
      },
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toBacktestRunDto(
    row: {
      id: string;
      userId: string;
      indicatorSetId: string | null;
      signalDefinitionId: string | null;
      strategyType: SignalDefinitionRow['strategyType'];
      paramsJson: unknown;
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
      sharpeRatio: DecimalLike;
      profitFactor: DecimalLike;
      buyHoldReturnRate: DecimalLike;
      buyHoldFinalEquity: DecimalLike;
      isActive: boolean;
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
        entryReason?: string | null;
        exitReason?: string | null;
        entryScore?: number | null | DecimalLike;
        exitScore?: number | null | DecimalLike;
        entryScoreBreakdown?: Prisma.JsonValue | null;
        exitScoreBreakdown?: Prisma.JsonValue | null;
      }>;
      equityPoints: Array<{
        id: string;
        backtestRunId: string;
        date: Date;
        cash: DecimalLike;
        positionValue: DecimalLike;
        equity: DecimalLike;
        drawdownRate: DecimalLike;
        decisionScore?: number | null | DecimalLike;
        scoreBreakdown?: Prisma.JsonValue | null;
      }>;
    },
  ): BacktestRunDto {
    return {
      id: row.id,
      userId: row.userId,
      indicatorSetId: row.indicatorSetId,
      signalDefinitionId: row.signalDefinitionId,
      strategyType: this.fromPrismaStrategyType(row.strategyType),
      params: row.paramsJson as SignalStrategyParams,
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
        sharpeRatio: this.toNumber(row.sharpeRatio),
        profitFactor: this.toNumber(row.profitFactor),
        buyHoldReturnRate: this.toNumber(row.buyHoldReturnRate),
        buyHoldFinalEquity: this.toNumber(row.buyHoldFinalEquity),
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
        entryReason: trade.entryReason ?? null,
        exitReason: trade.exitReason ?? null,
        entryScore:
          trade.entryScore == null ? null : this.toNumber(trade.entryScore),
        exitScore: trade.exitScore == null ? null : this.toNumber(trade.exitScore),
        entryScoreBreakdown: this.toScoreBreakdown(trade.entryScoreBreakdown),
        exitScoreBreakdown: this.toScoreBreakdown(trade.exitScoreBreakdown),
      })),
      equityPoints: row.equityPoints.map((point) => ({
        id: point.id,
        backtestRunId: point.backtestRunId,
        date: point.date.toISOString().slice(0, 10),
        cash: this.toNumber(point.cash),
        positionValue: this.toNumber(point.positionValue),
        equity: this.toNumber(point.equity),
        drawdownRate: this.toNumber(point.drawdownRate),
        decisionScore:
          point.decisionScore == null ? null : this.toNumber(point.decisionScore),
        scoreBreakdown: this.toScoreBreakdown(point.scoreBreakdown),
      })),
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toNumber(value: DecimalLike): number {
    return typeof value === 'number' ? value : Number(value.toString());
  }

  /** Prisma Json → スコア内訳。不正／欠損は null。 */
  private toScoreBreakdown(
    raw: Prisma.JsonValue | null | undefined,
  ): BacktestScoreBreakdown | null {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const record = raw as Record<string, unknown>;
    const groups = record.groups;
    const indicators = record.indicators;
    if (
      groups == null ||
      typeof groups !== 'object' ||
      Array.isArray(groups) ||
      indicators == null ||
      typeof indicators !== 'object' ||
      Array.isArray(indicators)
    ) {
      return null;
    }
    return {
      groups: groups as BacktestScoreBreakdown['groups'],
      indicators: indicators as BacktestScoreBreakdown['indicators'],
    };
  }

  private fromPrismaStrategyType(value: SignalDefinitionRow['strategyType']): SignalStrategyType {
    if (value === 'SMA_CROSS') {
      return 'smaCross';
    }
    if (value === 'RSI_THRESHOLD') {
      return 'rsiThreshold';
    }
    if (value === 'TREND_SCORE_THRESHOLD') {
      return 'trendScoreThreshold';
    }
    return 'macdCross';
  }

  private toPrismaStrategyType(value: SignalStrategyType): PrismaStrategyType {
    if (value === 'smaCross') {
      return 'SMA_CROSS';
    }
    if (value === 'rsiThreshold') {
      return 'RSI_THRESHOLD';
    }
    if (value === 'trendScoreThreshold') {
      return 'TREND_SCORE_THRESHOLD';
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
    if (strategyType === 'trendScoreThreshold') {
      const scoreParams = params as TrendScoreThresholdParams;
      return {
        strategyType,
        buyThreshold: scoreParams.buyThreshold,
        sellThreshold: scoreParams.sellThreshold,
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

  private toParamOverrides(raw: unknown) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return undefined;
    }
    return raw as Record<string, Record<string, number>>;
  }
}
