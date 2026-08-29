import {
  BacktestRunSearchQueryDto,
  CreateSignalDefinitionDto,
  OptimizeBacktestDto,
  RunBacktestDto,
  UpdateSignalDefinitionDto,
} from '../../src/signals-backtests/signals-backtests.dto';
import { plainToInstance } from 'class-transformer';

describe('signals-backtests DTOs', () => {
  it('constructs DTO instances', () => {
    const create = new CreateSignalDefinitionDto();
    create.name = 'SMA';
    create.strategyType = 'smaCross';
    create.params = { shortPeriod: 5, longPeriod: 20 };
    expect(create.name).toBe('SMA');

    const update = new UpdateSignalDefinitionDto();
    update.isActive = false;
    expect(update.isActive).toBe(false);

    const run = new RunBacktestDto();
    run.signalMode = 'trendScore';
    run.indicatorSetId = 'iset';
    run.symbolId = 'sym';
    run.from = '2026-01-01';
    run.to = '2026-06-30';
    run.initialCash = 1000;
    run.feeRate = 0;
    run.slippageRate = 0;
    run.buyThreshold = 37.5;
    run.sellThreshold = -42.5;
    expect(run.indicatorSetId).toBe('iset');
    expect(run.signalMode).toBe('trendScore');
    expect(run.symbolId).toBe('sym');

    const transformed = plainToInstance(RunBacktestDto, {
      signalMode: 'trendScore',
      indicatorSetId: 'iset',
      symbolId: 'sym',
      from: '2026-01-01',
      to: '2026-06-30',
      initialCash: '1000',
      feeRate: '0.001',
      feeMode: 'fixed',
      feeFixed: '100',
      slippageRate: '0.001',
      tradeSidePolicy: 'longShort',
      moneyManagement: { enabled: false },
      buyThreshold: '37.5',
      sellThreshold: '-42.5',
    });
    expect(transformed.initialCash).toBe(1000);
    expect(transformed.buyThreshold).toBe(37.5);
    expect(transformed.sellThreshold).toBe(-42.5);
    expect(transformed.indicatorSetId).toBe('iset');
    expect(typeof transformed.initialCash).toBe('number');
    expect(typeof transformed.feeRate).toBe('number');
    expect(typeof transformed.slippageRate).toBe('number');
    expect(transformed.feeMode).toBe('fixed');
    expect(transformed.feeFixed).toBe(100);
    expect(transformed.tradeSidePolicy).toBe('longShort');

    const optimize = plainToInstance(OptimizeBacktestDto, {
      symbolId: 'sym',
      from: '2026-01-01',
      to: '2026-06-30',
      initialCash: '100000',
      feeRate: '0.001',
      feeMode: 'rate',
      feeFixed: '0',
      slippageRate: '0.001',
      tradeSidePolicy: 'longOnly',
    });
    expect(optimize.symbolId).toBe('sym');
    expect(typeof optimize.initialCash).toBe('number');
    expect(typeof optimize.feeRate).toBe('number');
    expect(typeof optimize.slippageRate).toBe('number');
    expect((optimize as unknown as Record<string, unknown>).shortMin).toBeUndefined();
    expect((optimize as unknown as Record<string, unknown>).shortMax).toBeUndefined();

    const search = new BacktestRunSearchQueryDto();
    search.symbolId = 'sym_1';
    search.strategyType = 'smaCross';
    search.indicatorSetId = 'set_1';
    search.fromDate = '2026-01-01';
    search.toDate = '2026-06-30';
    search.createdFrom = '2026-02-01';
    search.createdTo = '2026-03-01';
    search.isActive = 'all';
    expect(search.symbolId).toBe('sym_1');
  });
});
