import { StubMarketDataProvider } from '../../../src/market-data/providers/stub-market-data.provider';

describe('StubMarketDataProvider', () => {
  const provider = new StubMarketDataProvider();

  it('returns bars for the inclusive date range', async () => {
    const bars = await provider.fetchDailyBars('AAPL', '2026-01-01', '2026-01-03');

    expect(bars).toHaveLength(3);
    expect(bars[0]?.date).toBe('2026-01-01');
    expect(bars[2]?.date).toBe('2026-01-03');
    expect(bars[0]?.volume).toBeGreaterThan(0);
    expect(typeof bars[0]?.open).toBe('number');
    expect(typeof bars[0]?.high).toBe('number');
    expect(typeof bars[0]?.low).toBe('number');
    expect(typeof bars[0]?.close).toBe('number');
  });

  it('is deterministic for the same ticker and date', async () => {
    const first = await provider.fetchDailyBars('7203.T', '2026-02-01', '2026-02-01');
    const second = await provider.fetchDailyBars('7203.T', '2026-02-01', '2026-02-01');
    expect(first).toEqual(second);
  });

  it('returns US quote metadata for non-.T tickers', async () => {
    await expect(provider.fetchQuote('AAPL')).resolves.toEqual({
      name: 'Stub AAPL',
      currency: 'USD',
      exchange: 'NASDAQ',
    });
  });

  it('returns JP quote metadata for .T tickers', async () => {
    await expect(provider.fetchQuote('7203.t')).resolves.toEqual({
      name: 'Stub 7203.t',
      currency: 'JPY',
      exchange: 'TSE',
    });
  });
});
