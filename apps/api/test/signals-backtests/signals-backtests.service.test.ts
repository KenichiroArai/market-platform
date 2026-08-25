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

describe('SignalsBacktestsService', () => {
  const prisma = {
    signalDefinition: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    backtestRun: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const prismaService = { prisma } as any;
  const pricesService = { listBySymbolId: jest.fn() } as any;
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
      id: 'run_1',
      userId: 'u_1',
      signalDefinitionId: 'sig_1',
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
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    prisma.backtestRun.findMany.mockResolvedValue([row]);
    prisma.backtestRun.findFirst.mockResolvedValue(row);
    await expect(service.listBacktestRuns('u_1')).resolves.toHaveLength(1);
    await expect(service.getBacktestRun('u_1', 'run_1')).resolves.toMatchObject({ id: 'run_1' });
    prisma.backtestRun.findFirst.mockResolvedValueOnce(null);
    await expect(service.getBacktestRun('u_1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('runs backtest and persists result', async () => {
    prisma.signalDefinition.findFirst.mockResolvedValue(signalRow);
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
      id: 'run_1',
      userId: 'u_1',
      signalDefinitionId: 'sig_1',
      symbolId: 'sym_1',
      fromDate: new Date('2026-01-01'),
      toDate: new Date('2026-06-30'),
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
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    try {
      await expect(
        service.runBacktest('u_1', {
          signalDefinitionId: 'sig_1',
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 100000,
          feeRate: 0.001,
          slippageRate: 0.001,
        } as any),
      ).resolves.toMatchObject({ id: 'run_1' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('optimizes SMA params without persisting', async () => {
    pricesService.listBySymbolId.mockResolvedValue([
      { date: '2026-01-01', open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ shortPeriod: 5, longPeriod: 20, summary: enrichedSummary }],
      }),
    }) as any;
    try {
      await expect(
        service.optimizeBacktest('u_1', {
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 100000,
          feeRate: 0.001,
          slippageRate: 0.001,
        } as any),
      ).resolves.toMatchObject({ results: [{ shortPeriod: 5, longPeriod: 20 }] });
      expect(prisma.backtestRun.create).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects invalid optimize ranges and upstream errors', async () => {
    await expect(
      service.optimizeBacktest('u_1', {
        symbolId: 'sym_1',
        from: '2026-01-01',
        to: '2026-06-30',
        initialCash: 100000,
        feeRate: 0,
        slippageRate: 0,
        shortMin: 20,
        shortMax: 5,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);

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
    expect(anyService.toPrismaStrategyType('smaCross')).toBe('SMA_CROSS');
    expect(anyService.toPrismaStrategyType('rsiThreshold')).toBe('RSI_THRESHOLD');
    expect(anyService.toPrismaStrategyType('macdCross')).toBe('MACD_CROSS');
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
      signalDefinitionId: 'sig_1',
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
        },
      ],
      equityPoints: [],
    });
    expect(sellMapped.trades[0].side).toBe('sell');
  });
});
