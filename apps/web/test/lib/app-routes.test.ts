import { backtestsHref, chartsHref, strategyHref, symbolsHref } from '../../lib/app-routes';

describe('app-routes', () => {
  it('returns /symbols', () => {
    expect(symbolsHref()).toBe('/symbols');
  });

  it('returns /charts without query when empty', () => {
    expect(chartsHref()).toBe('/charts');
    expect(chartsHref({})).toBe('/charts');
  });

  it('builds charts URL with provided query params only', () => {
    expect(chartsHref({ symbolId: 'sym_1' })).toBe('/charts?symbolId=sym_1');
    expect(
      chartsHref({
        symbolId: 'sym_1',
        watchlistId: 'wl_1',
        from: '2026-01-01',
        to: '2026-06-30',
      }),
    ).toBe('/charts?symbolId=sym_1&watchlistId=wl_1&from=2026-01-01&to=2026-06-30');
  });

  it('returns /backtests without query when empty', () => {
    expect(backtestsHref()).toBe('/backtests');
    expect(backtestsHref({})).toBe('/backtests');
  });

  it('builds backtests URL with indicatorSetId and optional filters', () => {
    expect(backtestsHref({ indicatorSetId: 'set_1' })).toBe('/backtests?indicatorSetId=set_1');
    expect(
      backtestsHref({
        indicatorSetId: 'set_1',
        symbolId: 'sym_1',
        from: '2026-01-01',
        to: '2026-06-30',
      }),
    ).toBe(
      '/backtests?indicatorSetId=set_1&symbolId=sym_1&from=2026-01-01&to=2026-06-30',
    );
  });

  it('returns /strategy without query when empty', () => {
    expect(strategyHref()).toBe('/strategy');
    expect(strategyHref({})).toBe('/strategy');
  });

  it('builds strategy URL with symbol and exit methods', () => {
    expect(
      strategyHref({
        symbolId: 'sym_1',
        stopMethod: 'atr',
        takeProfitMethod: 'rr_target',
        equity: 100000,
        riskRate: 0.01,
      }),
    ).toBe(
      '/strategy?symbolId=sym_1&stopMethod=atr&takeProfitMethod=rr_target&equity=100000&riskRate=0.01',
    );
  });

  it('omits null stopMethod and non-finite numbers', () => {
    expect(
      strategyHref({
        symbolId: 'sym_1',
        stopMethod: null,
        takeProfitMethod: null,
        equity: Number.NaN,
        riskRate: Number.POSITIVE_INFINITY,
      }),
    ).toBe('/strategy?symbolId=sym_1');
  });
});
