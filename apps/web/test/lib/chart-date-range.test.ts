import { defaultChartFromDate, defaultChartToDate } from '../../lib/chart-date-range';

describe('defaultChartFromDate', () => {
  it('returns the first day of the same month one year ago', () => {
    expect(defaultChartFromDate(new Date(2026, 7, 18))).toBe('2025-08-01');
  });

  it('keeps January as January of the previous year', () => {
    expect(defaultChartFromDate(new Date(2026, 0, 15))).toBe('2025-01-01');
  });

  it('uses the current date when now is omitted', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 18));
    expect(defaultChartFromDate()).toBe('2025-08-01');
    jest.useRealTimers();
  });
});

describe('defaultChartToDate', () => {
  it('returns the last day of next month', () => {
    expect(defaultChartToDate(new Date(2026, 7, 18))).toBe('2026-09-30');
  });

  it('wraps December to January of the next year', () => {
    expect(defaultChartToDate(new Date(2026, 11, 15))).toBe('2027-01-31');
  });

  it('uses February 29 in a leap year', () => {
    expect(defaultChartToDate(new Date(2028, 0, 18))).toBe('2028-02-29');
  });

  it('uses February 28 in a non-leap year', () => {
    expect(defaultChartToDate(new Date(2027, 0, 31))).toBe('2027-02-28');
  });

  it('uses the current date when now is omitted', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 18));
    expect(defaultChartToDate()).toBe('2026-09-30');
    jest.useRealTimers();
  });
});
