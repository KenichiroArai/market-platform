import {
  createMarketDataProviderBinding,
  resolveMarketDataProviderName,
} from '../../../src/market-data/providers/provider.token';
import { StubMarketDataProvider } from '../../../src/market-data/providers/stub-market-data.provider';
import { YahooFinanceProvider } from '../../../src/market-data/providers/yahoo-finance.provider';

describe('provider.token', () => {
  const original = process.env.MARKET_DATA_PROVIDER;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.MARKET_DATA_PROVIDER;
    } else {
      process.env.MARKET_DATA_PROVIDER = original;
    }
  });

  it('resolves stub and defaults to yahoo', () => {
    expect(resolveMarketDataProviderName('stub')).toBe('stub');
    expect(resolveMarketDataProviderName('yahoo')).toBe('yahoo');
    expect(resolveMarketDataProviderName(undefined)).toBe('yahoo');
    expect(resolveMarketDataProviderName('other')).toBe('yahoo');
  });

  it('binds stub provider when env is stub', () => {
    process.env.MARKET_DATA_PROVIDER = 'stub';
    const binding = createMarketDataProviderBinding() as {
      useFactory: (yahoo: YahooFinanceProvider, stub: StubMarketDataProvider) => unknown;
    };
    const yahoo = {} as YahooFinanceProvider;
    const stub = {} as StubMarketDataProvider;
    expect(binding.useFactory(yahoo, stub)).toBe(stub);
  });

  it('binds yahoo provider by default', () => {
    delete process.env.MARKET_DATA_PROVIDER;
    const binding = createMarketDataProviderBinding() as {
      useFactory: (yahoo: YahooFinanceProvider, stub: StubMarketDataProvider) => unknown;
    };
    const yahoo = {} as YahooFinanceProvider;
    const stub = {} as StubMarketDataProvider;
    expect(binding.useFactory(yahoo, stub)).toBe(yahoo);
  });
});
