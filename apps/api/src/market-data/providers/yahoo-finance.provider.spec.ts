const chartMock = jest.fn();

jest.mock('yahoo-finance2', () =>
  jest.fn().mockImplementation(() => ({
    chart: chartMock,
  })),
);

import { YahooFinanceProvider } from './yahoo-finance.provider';

describe('YahooFinanceProvider', () => {
  beforeEach(() => {
    chartMock.mockReset();
  });

  it('maps chart quotes to DailyBar and skips incomplete rows', async () => {
    chartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date('2026-01-02T00:00:00.000Z'),
          open: 10,
          high: 12,
          low: 9,
          close: 11,
          volume: 1000,
        },
        {
          date: new Date('2026-01-03T00:00:00.000Z'),
          open: null,
          high: 12,
          low: 9,
          close: 11,
          volume: 1000,
        },
        {
          date: new Date('2026-01-04T00:00:00.000Z'),
          open: 10,
          high: null,
          low: 9,
          close: 11,
          volume: 1000,
        },
        {
          date: new Date('2026-01-05T00:00:00.000Z'),
          open: 10,
          high: 12,
          low: null,
          close: 11,
          volume: 1000,
        },
        {
          date: new Date('2026-01-06T00:00:00.000Z'),
          open: 10,
          high: 12,
          low: 9,
          close: null,
          volume: 1000,
        },
        {
          date: new Date('2026-01-07T00:00:00.000Z'),
          open: 10,
          high: 12,
          low: 9,
          close: 11,
          volume: null,
        },
      ],
    });

    const provider = new YahooFinanceProvider();
    const bars = await provider.fetchDailyBars('AAPL', '2026-01-02', '2026-01-03');

    expect(chartMock).toHaveBeenCalledWith('AAPL', {
      period1: '2026-01-02',
      period2: '2026-01-04',
      interval: '1d',
    });
    expect(bars).toEqual([
      {
        date: '2026-01-02',
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        volume: 1000,
      },
    ]);
  });

  it('fetches via yahoo-finance2 client', async () => {
    chartMock.mockResolvedValue({
      quotes: [
        {
          date: new Date('2026-01-02T00:00:00.000Z'),
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
          volume: 10,
        },
      ],
    });

    const provider = new YahooFinanceProvider();
    const bars = await provider.fetchDailyBars('MSFT', '2026-01-02', '2026-01-02');

    expect(chartMock).toHaveBeenCalledWith('MSFT', {
      period1: '2026-01-02',
      period2: '2026-01-03',
      interval: '1d',
    });
    expect(bars).toHaveLength(1);
    expect(bars[0]?.close).toBe(1.5);
  });
});
