import {
  CreateSignalDefinitionDto,
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
    run.signalDefinitionId = 'sig';
    run.symbolId = 'sym';
    run.from = '2026-01-01';
    run.to = '2026-06-30';
    run.initialCash = 1000;
    run.feeRate = 0;
    run.slippageRate = 0;
    expect(run.symbolId).toBe('sym');

    const transformed = plainToInstance(RunBacktestDto, {
      signalDefinitionId: 'sig',
      symbolId: 'sym',
      from: '2026-01-01',
      to: '2026-06-30',
      initialCash: '1000',
      feeRate: '0.001',
      slippageRate: '0.001',
    });
    expect(typeof transformed.initialCash).toBe('number');
    expect(typeof transformed.feeRate).toBe('number');
    expect(typeof transformed.slippageRate).toBe('number');
  });
});
