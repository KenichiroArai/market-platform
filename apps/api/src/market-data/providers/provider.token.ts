/**
 * MarketDataProvider の DI トークンと環境変数による実装切替。
 *
 * MARKET_DATA_PROVIDER=yahoo|stub（未設定時は yahoo）。
 * テストでは overrideProvider で Stub や mock を差し込む。
 */
import type { Provider } from '@nestjs/common';
import type { MarketDataProvider } from './market-data.provider';
import { StubMarketDataProvider } from './stub-market-data.provider';
import { YahooFinanceProvider } from './yahoo-finance.provider';

/** Nest DI 用のトークン。 */
export const MARKET_DATA_PROVIDER = Symbol('MARKET_DATA_PROVIDER');

/** 環境変数名。 */
export const MARKET_DATA_PROVIDER_ENV = 'MARKET_DATA_PROVIDER';

/**
 * env 値からプロバイダ実装を選ぶ。
 * 未知の値は yahoo にフォールバックし、誤設定でも起動可能にする。
 */
export function resolveMarketDataProviderName(
  value: string | undefined,
): 'yahoo' | 'stub' {
  if (value === 'stub') {
    return 'stub';
  }
  return 'yahoo';
}

/** AppModule / MarketDataModule に登録する Provider 定義。 */
export function createMarketDataProviderBinding(): Provider {
  return {
    provide: MARKET_DATA_PROVIDER,
    useFactory: (
      yahoo: YahooFinanceProvider,
      stub: StubMarketDataProvider,
    ): MarketDataProvider => {
      const name = resolveMarketDataProviderName(process.env[MARKET_DATA_PROVIDER_ENV]);
      return name === 'stub' ? stub : yahoo;
    },
    inject: [YahooFinanceProvider, StubMarketDataProvider],
  };
}
