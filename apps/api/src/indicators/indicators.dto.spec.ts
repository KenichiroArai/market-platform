import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetIndicatorsQueryDto } from './indicators.dto';

describe('GetIndicatorsQueryDto', () => {
  it('accepts empty query', async () => {
    const dto = plainToInstance(GetIndicatorsQueryDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts valid periods and indicator list', async () => {
    const dto = plainToInstance(GetIndicatorsQueryDto, {
      from: '2026-01-01',
      to: '2026-06-30',
      indicators: 'sma,ema',
      smaPeriod: '20',
      emaPeriod: '50',
      rsiPeriod: '14',
      macdFast: '12',
      macdSlow: '26',
      macdSignal: '9',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.smaPeriod).toBe(20);
  });

  it('rejects period below 1', async () => {
    const dto = plainToInstance(GetIndicatorsQueryDto, { smaPeriod: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
