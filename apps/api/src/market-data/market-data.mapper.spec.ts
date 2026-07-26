import {
  formatDateOnly,
  lookbackFromDate,
  parseDateOnly,
  toDailyPriceDto,
  toSymbolDto,
  todayDateOnly,
} from './market-data.mapper';

describe('market-data.mapper', () => {
  it('maps symbol rows', () => {
    const dto = toSymbolDto({
      id: 's1',
      ticker: 'AAPL',
      market: 'US',
      name: 'Apple',
      currency: 'USD',
      exchange: 'NASDAQ',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    expect(dto.ticker).toBe('AAPL');
    expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('maps daily price rows with Decimal-like and bigint values', () => {
    const dto = toDailyPriceDto({
      id: 'p1',
      symbolId: 's1',
      date: new Date('2026-01-03T00:00:00.000Z'),
      open: { toString: () => '10.5' },
      high: 11,
      low: '9.5',
      close: 10,
      volume: 123n,
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    });
    expect(dto).toEqual(
      expect.objectContaining({
        date: '2026-01-03',
        open: 10.5,
        high: 11,
        low: 9.5,
        close: 10,
        volume: 123,
      }),
    );
  });

  it('maps volume when already a number', () => {
    const dto = toDailyPriceDto({
      id: 'p1',
      symbolId: 's1',
      date: new Date('2026-01-03T00:00:00.000Z'),
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 50,
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    });
    expect(dto.volume).toBe(50);
  });

  it('parses and formats date-only values', () => {
    expect(formatDateOnly(parseDateOnly('2026-07-26'))).toBe('2026-07-26');
  });

  it('computes lookback and today in UTC', () => {
    const now = new Date('2026-01-31T15:00:00.000Z');
    expect(todayDateOnly(now)).toBe('2026-01-31');
    expect(lookbackFromDate(10, now)).toBe('2026-01-21');
  });
});
