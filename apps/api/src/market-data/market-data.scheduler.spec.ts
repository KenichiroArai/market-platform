import {
  DEFAULT_MARKET_DATA_CRON,
  MarketDataScheduler,
  resolveCronExpression,
} from './market-data.scheduler';
import { PriceSyncService } from './price-sync.service';

describe('MarketDataScheduler', () => {
  it('resolves cron expression with fallback', () => {
    expect(resolveCronExpression(undefined)).toBe(DEFAULT_MARKET_DATA_CRON);
    expect(resolveCronExpression('')).toBe(DEFAULT_MARKET_DATA_CRON);
    expect(resolveCronExpression('  ')).toBe(DEFAULT_MARKET_DATA_CRON);
    expect(resolveCronExpression('0 12 * * *')).toBe('0 12 * * *');
  });

  it('invokes price sync on cron handler', async () => {
    const priceSyncService = {
      syncPrices: jest.fn().mockResolvedValue({
        processedSymbols: 1,
        upsertedBars: 2,
        failures: [],
      }),
    } as unknown as PriceSyncService;

    const scheduler = new MarketDataScheduler(priceSyncService);
    await scheduler.handleCron();
    expect(priceSyncService.syncPrices).toHaveBeenCalledWith();
  });
});
