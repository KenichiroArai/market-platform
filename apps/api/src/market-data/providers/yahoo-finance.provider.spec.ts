const chartMock = jest.fn();
const quoteMock = jest.fn();

jest.mock('yahoo-finance2', () =>
  jest.fn().mockImplementation(() => ({
    chart: chartMock,
    quote: quoteMock,
  })),
);

import { YahooFinanceProvider } from './yahoo-finance.provider';

describe('YahooFinanceProvider', () => {
  beforeEach(() => {
    chartMock.mockReset();
    quoteMock.mockReset();
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

  it('maps quote preferring shortName and fullExchangeName', async () => {
    quoteMock.mockResolvedValue({
      shortName: 'Apple Inc.',
      longName: 'Apple Inc. Long',
      displayName: 'Apple',
      currency: 'USD',
      fullExchangeName: 'NasdaqGS',
      exchange: 'NMS',
    });

    const provider = new YahooFinanceProvider();
    await expect(provider.fetchQuote('AAPL')).resolves.toEqual({
      name: 'Apple Inc.',
      currency: 'USD',
      exchange: 'NasdaqGS',
    });
  });

  it('falls back through name and exchange fields', async () => {
    quoteMock
      .mockResolvedValueOnce({
        shortName: '  ',
        longName: 'Toyota Motor',
        currency: 'JPY',
        exchange: 'JPX',
      })
      .mockResolvedValueOnce({
        displayName: 'Sony',
        currency: 'JPY',
      })
      .mockResolvedValueOnce({
        currency: 'USD',
      });

    const provider = new YahooFinanceProvider();
    await expect(provider.fetchQuote('7203.T')).resolves.toEqual({
      name: 'Toyota Motor',
      currency: 'JPY',
      exchange: 'JPX',
    });
    await expect(provider.fetchQuote('6758.T')).resolves.toEqual({
      name: 'Sony',
      currency: 'JPY',
      exchange: null,
    });
    await expect(provider.fetchQuote('MSFT')).resolves.toEqual({
      name: 'MSFT',
      currency: 'USD',
      exchange: null,
    });
  });

  it('throws when quote has no currency', async () => {
    quoteMock.mockResolvedValue({ shortName: 'X', currency: null });
    const provider = new YahooFinanceProvider();
    await expect(provider.fetchQuote('X')).rejects.toThrow('Yahoo quote missing currency for X');
  });
});
