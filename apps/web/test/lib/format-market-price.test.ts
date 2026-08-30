/**
 * @jest-environment node
 */
import {
  formatMarketPrice,
  marketSeriesPriceFormat,
  resolveDisplayCurrency,
} from '../../lib/format-market-price';

describe('format-market-price', () => {
  it('resolves JPY from JP market or .T ticker even if currency is wrong', () => {
    expect(resolveDisplayCurrency({ currency: 'USD', market: 'JP', ticker: '7203.T' })).toBe(
      'JPY',
    );
    expect(resolveDisplayCurrency({ currency: null, ticker: '7203.T' })).toBe('JPY');
    expect(resolveDisplayCurrency({ currency: 'USD', market: 'US', ticker: 'AAPL' })).toBe('USD');
  });

  it('formats JPY with yen suffix', () => {
    expect(formatMarketPrice(3116, 'JPY')).toBe('3,116円');
    expect(formatMarketPrice(99.5, 'JPY')).toBe('99.5円');
  });

  it('formats USD as currency', () => {
    expect(formatMarketPrice(123.45, 'USD')).toContain('123.45');
  });

  it('builds series price format for JPY', () => {
    const fmt = marketSeriesPriceFormat('JPY');
    expect(fmt?.type).toBe('custom');
    expect(fmt?.minMove).toBe(0.5);
    expect(fmt?.formatter(3116)).toBe('3,116円');
  });
});
