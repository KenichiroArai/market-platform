import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetIndicatorsQueryDto, GetTrendScoreQueryDto } from './indicators.dto';

describe('GetIndicatorsQueryDto', () => {
  it('accepts empty query', async () => {
    const dto = plainToInstance(GetIndicatorsQueryDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts valid indicator list and interval', async () => {
    const dto = plainToInstance(GetIndicatorsQueryDto, {
      from: '2026-01-01',
      to: '2026-06-30',
      interval: '1w',
      indicators: 'sma25,macd',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.indicators).toBe('sma25,macd');
  });

  it('rejects invalid interval', async () => {
    const dto = plainToInstance(GetIndicatorsQueryDto, { interval: '1m' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('GetTrendScoreQueryDto', () => {
  it('accepts empty query', async () => {
    const dto = plainToInstance(GetTrendScoreQueryDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts valid range and interval', async () => {
    const dto = plainToInstance(GetTrendScoreQueryDto, {
      from: '2026-01-01',
      to: '2026-06-30',
      interval: '1w',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects invalid interval', async () => {
    const dto = plainToInstance(GetTrendScoreQueryDto, { interval: '1m' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
