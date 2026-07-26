/**
 * 価格取得ジョブのオーケストレーション。
 *
 * アクティブ銘柄（または指定 ID）を走査し、MarketDataProvider から日足を取得して upsert する。
 * 1 銘柄の失敗で全体を落とさず、failures に理由を積む。
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  createPriceSyncJobResult,
  type PriceSyncJobResult,
} from '@market/shared-types';
import { PrismaService } from '../prisma.service';
import {
  lookbackFromDate,
  parseDateOnly,
  todayDateOnly,
} from './market-data.mapper';
import type { MarketDataProvider } from './providers/market-data.provider';
import { MARKET_DATA_PROVIDER } from './providers/provider.token';

/** 取得期間の既定日数（環境変数未設定時）。 */
export const DEFAULT_LOOKBACK_DAYS = 30;

@Injectable()
export class PriceSyncService {
  private readonly logger = new Logger(PriceSyncService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(MARKET_DATA_PROVIDER)
    private readonly provider: MarketDataProvider,
  ) {}

  /**
   * 価格同期を実行する。
   * from/to 省略時は lookback〜今日（UTC）。symbolIds 省略時は isActive 全件。
   */
  async syncPrices(options?: {
    symbolIds?: string[];
    from?: string;
    to?: string;
  }): Promise<PriceSyncJobResult> {
    const lookbackDays = resolveLookbackDays(process.env.MARKET_DATA_LOOKBACK_DAYS);
    const from = options?.from ?? lookbackFromDate(lookbackDays);
    const to = options?.to ?? todayDateOnly();

    const symbols = await this.prismaService.prisma.symbol.findMany({
      where: options?.symbolIds?.length
        ? { id: { in: options.symbolIds } }
        : { isActive: true },
      orderBy: [{ market: 'asc' }, { ticker: 'asc' }],
    });

    let upsertedBars = 0;
    const failures: PriceSyncJobResult['failures'] = [];

    for (const symbol of symbols) {
      try {
        const bars = await this.provider.fetchDailyBars(symbol.ticker, from, to);
        for (const bar of bars) {
          await this.prismaService.prisma.dailyPrice.upsert({
            where: {
              symbolId_date: {
                symbolId: symbol.id,
                date: parseDateOnly(bar.date),
              },
            },
            create: {
              symbolId: symbol.id,
              date: parseDateOnly(bar.date),
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: BigInt(Math.trunc(bar.volume)),
            },
            update: {
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: BigInt(Math.trunc(bar.volume)),
            },
          });
          upsertedBars += 1;
        }
      } catch (error: unknown) {
        const reason =
          error instanceof Error ? error.message : 'Unknown provider error';
        this.logger.warn(`Price sync failed for ${symbol.ticker}: ${reason}`);
        failures.push({
          symbolId: symbol.id,
          ticker: symbol.ticker,
          reason,
        });
      }
    }

    return createPriceSyncJobResult(symbols.length, upsertedBars, failures);
  }
}

/** MARKET_DATA_LOOKBACK_DAYS を正の整数に正規化する。 */
export function resolveLookbackDays(value: string | undefined): number {
  if (!value) {
    return DEFAULT_LOOKBACK_DAYS;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LOOKBACK_DAYS;
  }
  return parsed;
}
