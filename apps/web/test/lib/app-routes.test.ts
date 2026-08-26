import { backtestsHref, chartsHref, symbolsHref } from '../../lib/app-routes';

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
});
