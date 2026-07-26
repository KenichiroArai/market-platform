/**
 * 日次の価格同期スケジューラ。
 *
 * MARKET_DATA_CRON（既定: 0 6 * * * UTC）で PriceSyncService を呼ぶ。
 * Cron 式の解決はモジュール起動時に行い、テストでは resolveCronExpression を直接検証する。
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PriceSyncService } from './price-sync.service';

/** 既定 cron（毎日 06:00 UTC）。日米の前営業日データが揃いやすい時刻。 */
export const DEFAULT_MARKET_DATA_CRON = '0 6 * * *';

/** env から cron 式を解決する。空文字は既定にフォールバック。 */
export function resolveCronExpression(value: string | undefined): string {
  if (!value || value.trim() === '') {
    return DEFAULT_MARKET_DATA_CRON;
  }
  return value.trim();
}

@Injectable()
export class MarketDataScheduler {
  private readonly logger = new Logger(MarketDataScheduler.name);

  constructor(private readonly priceSyncService: PriceSyncService) {}

  /**
   * 定期同期。Cron 式はモジュール読込時の MARKET_DATA_CRON（未設定時は既定）。
   */
  @Cron(resolveCronExpression(process.env.MARKET_DATA_CRON))
  async handleCron(): Promise<void> {
    this.logger.log('Starting scheduled price sync');
    const result = await this.priceSyncService.syncPrices();
    this.logger.log(
      `Scheduled price sync done: symbols=${result.processedSymbols} bars=${result.upsertedBars} failures=${result.failures.length}`,
    );
  }
}
