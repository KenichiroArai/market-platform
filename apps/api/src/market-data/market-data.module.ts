/**
 * 市場データモジュール。
 *
 * Provider 抽象・価格同期・スケジューラ・銘柄/価格サービスをまとめて提供する。
 */
import { Module } from '@nestjs/common';
import { PricesService } from '../prices/prices.service';
import { SymbolsController } from '../symbols/symbols.controller';
import { SymbolsService } from '../symbols/symbols.service';
import { MarketDataController } from './market-data.controller';
import { MarketDataScheduler } from './market-data.scheduler';
import { PriceSyncService } from './price-sync.service';
import { createMarketDataProviderBinding } from './providers/provider.token';
import { StubMarketDataProvider } from './providers/stub-market-data.provider';
import { YahooFinanceProvider } from './providers/yahoo-finance.provider';

@Module({
  controllers: [SymbolsController, MarketDataController],
  providers: [
    SymbolsService,
    PricesService,
    PriceSyncService,
    MarketDataScheduler,
    YahooFinanceProvider,
    StubMarketDataProvider,
    createMarketDataProviderBinding(),
  ],
  exports: [SymbolsService, PricesService, PriceSyncService],
})
export class MarketDataModule {}
