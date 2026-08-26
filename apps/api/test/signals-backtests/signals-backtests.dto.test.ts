import {
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
    run.indicatorSetId = 'iset';
    run.symbolId = 'sym';
    run.from = '2026-01-01';
    run.to = '2026-06-30';
    run.initialCash = 1000;
    run.feeRate = 0;
    run.slippageRate = 0;
    expect(run.indicatorSetId).toBe('iset');
    expect(run.symbolId).toBe('sym');

    const transformed = plainToInstance(RunBacktestDto, {
      indicatorSetId: 'iset',
      symbolId: 'sym',
      from: '2026-01-01',
      to: '2026-06-30',
      initialCash: '1000',
      feeRate: '0.001',
      slippageRate: '0.001',
    });
    expect(transformed.indicatorSetId).toBe('iset');
    expect(typeof transformed.initialCash).toBe('number');
    expect(typeof transformed.feeRate).toBe('number');
    expect(typeof transformed.slippageRate).toBe('number');

    const optimize = plainToInstance(OptimizeBacktestDto, {
      symbolId: 'sym',
      from: '2026-01-01',
      to: '2026-06-30',
      initialCash: '100000',
      feeRate: '0.001',
      slippageRate: '0.001',
    });
    expect(optimize.symbolId).toBe('sym');
    expect(typeof optimize.initialCash).toBe('number');
    expect(typeof optimize.feeRate).toBe('number');
    expect(typeof optimize.slippageRate).toBe('number');
    expect((optimize as unknown as Record<string, unknown>).shortMin).toBeUndefined();
    expect((optimize as unknown as Record<string, unknown>).shortMax).toBeUndefined();
  });
});
