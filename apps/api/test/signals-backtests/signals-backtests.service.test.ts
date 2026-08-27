import { BadGatewayException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SignalsBacktestsService } from '../../src/signals-backtests/signals-backtests.service';

const enrichedSummary = {
  finalEquity: 100001,
  totalReturnRate: 0.00001,
  maxDrawdownRate: 0,
  totalTrades: 1,
  winRate: 1,
  sharpeRatio: 0.5,
  profitFactor: 1.2,
  buyHoldReturnRate: 0.01,
  buyHoldFinalEquity: 101000,
};

const backtestRunBase = {
  id: 'run_1',
  userId: 'u_1',
  indicatorSetId: 'iset_1',
  signalDefinitionId: null as string | null,
  strategyType: 'SMA_CROSS' as const,
  paramsJson: { shortPeriod: 25, longPeriod: 75 },
  symbolId: 'sym_1',
  fromDate: new Date('2026-01-01'),
  toDate: new Date('2026-06-30'),
  initialCash: { toString: () => '100000' },
  feeRate: { toString: () => '0.001' },
  slippageRate: { toString: () => '0.001' },
  finalEquity: { toString: () => '110000' },
  totalReturnRate: { toString: () => '0.1' },
  maxDrawdownRate: { toString: () => '0.05' },
  totalTrades: 1,
  winRate: { toString: () => '1' },
  sharpeRatio: { toString: () => '0.5' },
  profitFactor: { toString: () => '1.2' },
  buyHoldReturnRate: { toString: () => '0.01' },
  buyHoldFinalEquity: { toString: () => '101000' },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('SignalsBacktestsService', () => {
  const prisma = {
    signalDefinition: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    indicatorSet: {
      findFirst: jest.fn(),
    },
    backtestRun: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const prismaService = { prisma } as any;
  const pricesService = {
    listBySymbolId: jest.fn(),
    listWithLookback: jest.fn(),
  } as any;
  let service: SignalsBacktestsService;

  const signalRow = {
    id: 'sig_1',
    userId: 'u_1',
    name: 'SMA',
    description: null,
    strategyType: 'SMA_CROSS',
    paramsJson: { shortPeriod: 5, longPeriod: 20 },
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const indicatorSetRow = {
    id: 'iset_1',
    userId: 'u_1',
    name: 'SMA 25/75',
    indicatorIds: ['sma25', 'sma75'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SignalsBacktestsService(prismaService, pricesService);
  });

  it('lists and gets signal definitions', async () => {
    prisma.signalDefinition.findMany.mockResolvedValue([signalRow]);
    prisma.signalDefinition.findFirst.mockResolvedValue(signalRow);
    await expect(service.listSignalDefinitions('u_1')).resolves.toHaveLength(1);
    await expect(service.getSignalDefinition('u_1', 'sig_1')).resolves.toMatchObject({ id: 'sig_1' });
  });

  it('throws when signal definition missing', async () => {
    prisma.signalDefinition.findFirst.mockResolvedValue(null);
    await expect(service.getSignalDefinition('u_1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates, updates and deletes signal definition', async () => {
    prisma.signalDefinition.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(signalRow)
      .mockResolvedValueOnce(signalRow);
    prisma.signalDefinition.create.mockResolvedValue(signalRow);
    prisma.signalDefinition.update.mockResolvedValue(signalRow);
    prisma.signalDefinition.delete.mockResolvedValue(undefined);
    await expect(
      service.createSignalDefinition('u_1', {
        name: ' SMA ',
        strategyType: 'smaCross',
        params: { shortPeriod: 5, longPeriod: 20 },
      } as any),
    ).resolves.toMatchObject({ name: 'SMA' });
    await expect(service.updateSignalDefinition('u_1', 'sig_1', { name: 'new' })).resolves.toBeDefined();
    await expect(service.removeSignalDefinition('u_1', 'sig_1')).resolves.toBeUndefined();
  });

  it('rejects duplicate signal definition name', async () => {
    prisma.signalDefinition.findFirst.mockResolvedValue({ id: 'x' });
    await expect(
      service.createSignalDefinition('u_1', {
        name: 'dup',
        strategyType: 'smaCross',
        params: { shortPeriod: 5, longPeriod: 20 },
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists and gets backtest runs', async () => {
    const row = {
      ...backtestRunBase,
      trades: [
        {
          id: 't_1',
          backtestRunId: 'run_1',
          symbolId: 'sym_1',
          entryDate: new Date('2026-01-10'),
          exitDate: new Date('2026-01-11'),
          entryPrice: 100,
          exitPrice: 101,
          quantity: 1,
          side: 'BUY' as const,
          grossPnl: 1,
          feeAmount: 0,
          slippageAmount: 0,
          netPnl: 1,
          entryReason: 'sma_golden_cross',
          exitReason: 'sma_dead_cross',
          entryScore: 28.5,
          exitScore: 71.2,
        },
      ],
      equityPoints: [
        {
          id: 'e_1',
          backtestRunId: 'run_1',
          date: new Date('2026-01-10'),
          cash: 1,
          positionValue: 2,
          equity: 3,
          drawdownRate: 0,
        },
      ],
    };
    prisma.backtestRun.findMany.mockResolvedValue([row]);
    prisma.backtestRun.findFirst.mockResolvedValue(row);
    const listed = await service.listBacktestRuns('u_1');
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: 'run_1',
      indicatorSetId: 'iset_1',
      signalDefinitionId: null,
      strategyType: 'smaCross',
      params: { shortPeriod: 25, longPeriod: 75 },
    });
    expect(listed[0]!.trades[0]).toMatchObject({
      entryReason: 'sma_golden_cross',
      exitReason: 'sma_dead_cross',
      entryScore: 28.5,
      exitScore: 71.2,
    });
    await expect(service.getBacktestRun('u_1', 'run_1')).resolves.toMatchObject({ id: 'run_1' });
    prisma.backtestRun.findFirst.mockResolvedValueOnce(null);
    await expect(service.getBacktestRun('u_1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('runs backtest from indicator set and persists result', async () => {
    prisma.indicatorSet.findFirst.mockResolvedValue(indicatorSetRow);
    pricesService.listBySymbolId.mockResolvedValue([
      { date: '2026-01-01', open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: enrichedSummary,
        trades: [
          {
            symbolId: 'sym_1',
            entryDate: '2026-01-01',
            exitDate: '2026-01-02',
            entryPrice: 1,
            exitPrice: 2,
            quantity: 1,
            side: 'buy',
            grossPnl: 1,
            feeAmount: 0,
            slippageAmount: 0,
            netPnl: 1,
          },
        ],
        equityPoints: [
          {
            date: '2026-01-01',
            cash: 100001,
            positionValue: 0,
            equity: 100001,
            drawdownRate: 0,
          },
          {
            date: '2026-01-02',
            cash: 100002,
            positionValue: 0,
            equity: 100002,
            drawdownRate: 0,
          },
        ],
      }),
    }) as any;
    prisma.backtestRun.create.mockResolvedValue({
      ...backtestRunBase,
      initialCash: 100000,
      feeRate: 0.001,
      slippageRate: 0.001,
      finalEquity: 100001,
      totalReturnRate: 0.00001,
      maxDrawdownRate: 0,
      totalTrades: 0,
      winRate: 0,
      sharpeRatio: 0,
      profitFactor: 0,
      buyHoldReturnRate: 0,
      buyHoldFinalEquity: 100000,
      trades: [],
      equityPoints: [],
    });
    try {
      await expect(
        service.runBacktest('u_1', {
          indicatorSetId: 'iset_1',
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 100000,
          feeRate: 0.001,
          slippageRate: 0.001,
        } as any),
      ).resolves.toMatchObject({
        id: 'run_1',
        indicatorSetId: 'iset_1',
        strategyType: 'smaCross',
        params: { shortPeriod: 25, longPeriod: 75 },
      });
      expect(prisma.indicatorSet.findFirst).toHaveBeenCalledWith({
        where: { id: 'iset_1', userId: 'u_1' },
      });
      expect(prisma.backtestRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            indicatorSetId: 'iset_1',
            signalDefinitionId: null,
            strategyType: 'SMA_CROSS',
            paramsJson: { shortPeriod: 25, longPeriod: 75 },
            trades: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({
                  entryReason: null,
                  exitReason: null,
                  entryScore: null,
                  exitScore: null,
                }),
              ]),
            }),
          }),
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects missing indicator set and unresolved signal rules', async () => {
    prisma.indicatorSet.findFirst.mockResolvedValue(null);
    await expect(
      service.runBacktest('u_1', {
        indicatorSetId: 'missing',
        symbolId: 'sym_1',
        from: '2026-01-01',
        to: '2026-06-30',
        initialCash: 100000,
        feeRate: 0.001,
        slippageRate: 0.001,
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.indicatorSet.findFirst.mockResolvedValue({
      ...indicatorSetRow,
      indicatorIds: ['sma25'],
    });
    await expect(
      service.runBacktest('u_1', {
        indicatorSetId: 'iset_1',
        symbolId: 'sym_1',
        from: '2026-01-01',
        to: '2026-06-30',
        initialCash: 100000,
        feeRate: 0.001,
        slippageRate: 0.001,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.runBacktest('u_1', {
        signalMode: 'indicatorSet',
        symbolId: 'sym_1',
        from: '2026-01-01',
        to: '2026-06-30',
        initialCash: 100000,
        feeRate: 0.001,
        slippageRate: 0.001,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('runs trend-score backtest with lookback and optional indicator set', async () => {
    pricesService.listWithLookback.mockResolvedValue({
      bars: [
        { date: '2025-12-01', open: 1, high: 1, low: 1, close: 1, volume: 1 },
        { date: '2026-01-01', open: 1, high: 1, low: 1, close: 1, volume: 1 },
      ],
      rangeStartIndex: 1,
    });
    prisma.indicatorSet.findFirst.mockResolvedValue(indicatorSetRow);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: enrichedSummary,
        trades: [
          {
            symbolId: 'sym_1',
            entryDate: '2026-01-01',
            exitDate: '2026-01-02',
            entryPrice: 1,
            exitPrice: 2,
            quantity: 1,
            side: 'buy',
            grossPnl: 1,
            feeAmount: 0,
            slippageAmount: 0,
            netPnl: 1,
            entryReason: 'score_cross_up',
            exitReason: 'score_cross_down',
            entryScore: 40,
            exitScore: -50,
          },
        ],
        equityPoints: [],
      }),
    }) as any;
    prisma.backtestRun.create.mockResolvedValue({
      ...backtestRunBase,
      strategyType: 'TREND_SCORE_THRESHOLD',
      paramsJson: { buyThreshold: 37.5, sellThreshold: -42.5 },
      trades: [],
      equityPoints: [],
    });
    try {
      await expect(
        service.runBacktest('u_1', {
          signalMode: 'trendScore',
          indicatorSetId: 'iset_1',
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 100000,
          feeRate: 0.001,
          slippageRate: 0.001,
        } as any),
      ).resolves.toMatchObject({
        strategyType: 'trendScoreThreshold',
        params: { buyThreshold: 37.5, sellThreshold: -42.5 },
      });
      expect(pricesService.listWithLookback).toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/backtests/run'),
        expect.objectContaining({
          body: expect.stringContaining('"rangeStartIndex":1'),
        }),
      );
      expect(prisma.backtestRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            strategyType: 'TREND_SCORE_THRESHOLD',
            paramsJson: { buyThreshold: 37.5, sellThreshold: -42.5 },
          }),
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 指標セットなしでも実行できる
    pricesService.listWithLookback.mockResolvedValue({
      bars: [{ date: '2026-01-01', open: 1, high: 1, low: 1, close: 1, volume: 1 }],
      rangeStartIndex: 0,
    });
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ summary: enrichedSummary, trades: [], equityPoints: [] }),
    }) as any;
    prisma.backtestRun.create.mockResolvedValue({
      ...backtestRunBase,
      indicatorSetId: null,
      strategyType: 'TREND_SCORE_THRESHOLD',
      paramsJson: { buyThreshold: 50, sellThreshold: -50 },
      trades: [],
      equityPoints: [],
    });
    try {
      await expect(
        service.runBacktest('u_1', {
          signalMode: 'trendScore',
          buyThreshold: 50,
          sellThreshold: -50,
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 100000,
          feeRate: 0.001,
          slippageRate: 0.001,
        } as any),
      ).resolves.toMatchObject({
        indicatorSetId: null,
        strategyType: 'trendScoreThreshold',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }

    await expect(
      service.runBacktest('u_1', {
        signalMode: 'trendScore',
        buyThreshold: 10,
        sellThreshold: 20,
        symbolId: 'sym_1',
        from: '2026-01-01',
        to: '2026-06-30',
        initialCash: 100000,
        feeRate: 0.001,
        slippageRate: 0.001,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.indicatorSet.findFirst.mockResolvedValue(null);
    await expect(
      service.runBacktest('u_1', {
        signalMode: 'trendScore',
        indicatorSetId: 'missing',
        symbolId: 'sym_1',
        from: '2026-01-01',
        to: '2026-06-30',
        initialCash: 100000,
        feeRate: 0.001,
        slippageRate: 0.001,
      } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('optimizes catalog SMA pairs without persisting', async () => {
    pricesService.listBySymbolId.mockResolvedValue([
      { date: '2026-01-01', open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ]);
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: { ...enrichedSummary, totalReturnRate: 0.02 }, trades: [], equityPoints: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: { ...enrichedSummary, totalReturnRate: 0.05 }, trades: [], equityPoints: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: { ...enrichedSummary, totalReturnRate: 0.01 }, trades: [], equityPoints: [] }),
      });
    globalThis.fetch = fetchMock as any;
    try {
      const result = await service.optimizeBacktest('u_1', {
        symbolId: 'sym_1',
        from: '2026-01-01',
        to: '2026-06-30',
        initialCash: 100000,
        feeRate: 0.001,
        slippageRate: 0.001,
      } as any);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(prisma.backtestRun.create).not.toHaveBeenCalled();
      expect(result.results).toHaveLength(3);
      expect(result.results.map((r) => [r.shortPeriod, r.longPeriod])).toEqual([
        [25, 200],
        [25, 75],
        [75, 200],
      ]);
      expect(result.results[0]?.summary.totalReturnRate).toBe(0.05);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects upstream errors during optimize', async () => {
    pricesService.listBySymbolId.mockResolvedValue([]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('down')) as any;
    try {
      await expect(
        service.optimizeBacktest('u_1', {
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 1,
          feeRate: 0,
          slippageRate: 0,
        } as any),
      ).rejects.toBeInstanceOf(BadGatewayException);
    } finally {
      globalThis.fetch = originalFetch;
    }

    globalThis.fetch = jest.fn().mockRejectedValue('down') as any;
    try {
      await expect(
        service.optimizeBacktest('u_1', {
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 1,
          feeRate: 0,
          slippageRate: 0,
        } as any),
      ).rejects.toBeInstanceOf(BadGatewayException);
    } finally {
      globalThis.fetch = originalFetch;
    }

    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;
    try {
      await expect(
        service.optimizeBacktest('u_1', {
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 1,
          feeRate: 0,
          slippageRate: 0,
        } as any),
      ).rejects.toBeInstanceOf(BadGatewayException);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('maps helper branches and handles upstream errors', async () => {
    const anyService = service as any;
    expect(anyService.fromPrismaStrategyType('SMA_CROSS')).toBe('smaCross');
    expect(anyService.fromPrismaStrategyType('RSI_THRESHOLD')).toBe('rsiThreshold');
    expect(anyService.fromPrismaStrategyType('MACD_CROSS')).toBe('macdCross');
    expect(anyService.fromPrismaStrategyType('TREND_SCORE_THRESHOLD')).toBe('trendScoreThreshold');
    expect(anyService.toPrismaStrategyType('smaCross')).toBe('SMA_CROSS');
    expect(anyService.toPrismaStrategyType('rsiThreshold')).toBe('RSI_THRESHOLD');
    expect(anyService.toPrismaStrategyType('macdCross')).toBe('MACD_CROSS');
    expect(anyService.toPrismaStrategyType('trendScoreThreshold')).toBe('TREND_SCORE_THRESHOLD');
    expect(anyService.toPrismaTradeSide('buy')).toBe('BUY');
    expect(anyService.toPrismaTradeSide('sell')).toBe('SELL');
    expect(anyService.toAnalysisSignalSpec('smaCross', { shortPeriod: 1, longPeriod: 2 })).toMatchObject({
      strategyType: 'smaCross',
    });
    expect(anyService.toAnalysisSignalSpec('rsiThreshold', { period: 14, lower: 30, upper: 70 })).toMatchObject({
      strategyType: 'rsiThreshold',
    });
    expect(anyService.toAnalysisSignalSpec('macdCross', { fast: 1, slow: 2, signal: 1 })).toMatchObject({
      strategyType: 'macdCross',
    });
    expect(
      anyService.toAnalysisSignalSpec('trendScoreThreshold', { buyThreshold: 37.5, sellThreshold: -42.5 }),
    ).toMatchObject({
      strategyType: 'trendScoreThreshold',
      buyThreshold: 37.5,
      sellThreshold: -42.5,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('down')) as any;
    try {
      await expect(
        anyService.callAnalysisBacktest({
          strategyType: 'smaCross',
          params: { shortPeriod: 5, longPeriod: 20 },
          bars: [],
          symbolId: 'sym_1',
          initialCash: 1,
          feeRate: 0,
          slippageRate: 0,
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    } finally {
      globalThis.fetch = originalFetch;
    }

    globalThis.fetch = jest.fn().mockRejectedValue('down') as any;
    try {
      await expect(
        anyService.callAnalysisBacktest({
          strategyType: 'smaCross',
          params: { shortPeriod: 5, longPeriod: 20 },
          bars: [],
          symbolId: 'sym_1',
          initialCash: 1,
          feeRate: 0,
          slippageRate: 0,
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    } finally {
      globalThis.fetch = originalFetch;
    }

    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;
    try {
      await expect(
        anyService.callAnalysisBacktest({
          strategyType: 'smaCross',
          params: { shortPeriod: 5, longPeriod: 20 },
          bars: [],
          symbolId: 'sym_1',
          initialCash: 1,
          feeRate: 0,
          slippageRate: 0,
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const sellMapped = anyService.toBacktestRunDto({
      id: 'run_sell',
      userId: 'u_1',
      indicatorSetId: null,
      signalDefinitionId: 'sig_1',
      strategyType: 'SMA_CROSS',
      paramsJson: { shortPeriod: 25, longPeriod: 75 },
      symbolId: 'sym_1',
      fromDate: new Date('2026-01-01'),
      toDate: new Date('2026-01-02'),
      initialCash: 1,
      feeRate: 0,
      slippageRate: 0,
      finalEquity: 1,
      totalReturnRate: 0,
      maxDrawdownRate: 0,
      totalTrades: 1,
      winRate: 0,
      sharpeRatio: 0,
      profitFactor: 0,
      buyHoldReturnRate: 0,
      buyHoldFinalEquity: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      trades: [
        {
          id: 't_sell',
          backtestRunId: 'run_sell',
          symbolId: 'sym_1',
          entryDate: new Date('2026-01-01'),
          exitDate: new Date('2026-01-02'),
          entryPrice: 1,
          exitPrice: 1,
          quantity: 1,
          side: 'SELL',
          grossPnl: 0,
          feeAmount: 0,
          slippageAmount: 0,
          netPnl: 0,
          entryReason: null,
          exitReason: null,
          entryScore: null,
          exitScore: null,
        },
      ],
      equityPoints: [],
    });
    expect(sellMapped.trades[0].side).toBe('sell');
    expect(sellMapped.indicatorSetId).toBeNull();
    expect(sellMapped.strategyType).toBe('smaCross');
    expect(sellMapped.params).toEqual({ shortPeriod: 25, longPeriod: 75 });
  });
});
