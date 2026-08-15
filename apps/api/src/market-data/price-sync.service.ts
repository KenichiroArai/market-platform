/**
 * 価格取得ジョブのオーケストレーション。
 *
 * アクティブ銘柄（または指定 ID）を走査し、MarketDataProvider から日足を取得して upsert する。
 * 既に DailyPrice がある銘柄は min より前・max より後だけ取り、中間は再取得しない。
 * 1 銘柄の失敗で全体を落とさず、failures に理由を積む。
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  createPriceSyncJobResult,
  type PriceSyncJobResult,
} from '@market/shared-types';
import { PrismaService } from '../prisma.service';
import {
  addDays,
  formatDateOnly,
  lookbackFromDate,
  parseDateOnly,
  todayDateOnly,
} from './market-data.mapper';
import type { DailyBar, MarketDataProvider } from './providers/market-data.provider';
import { MARKET_DATA_PROVIDER } from './providers/provider.token';

/** 取得期間の既定日数（環境変数未設定時）。 */
export const DEFAULT_LOOKBACK_DAYS = 30;

/** プロバイダへ渡す連続期間。 */
export type FetchRange = { from: string; to: string };

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
   * 各銘柄は保存済み min〜max の外側だけ取得する。
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
        upsertedBars += await this.syncSymbol(symbol.id, symbol.ticker, from, to);
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

  /**
   * 1 銘柄について不足期間だけ日足を取り、upsert した本数を返す。
   * カバー済みならプロバイダは呼ばない。
   */
  private async syncSymbol(
    symbolId: string,
    ticker: string,
    from: string,
    to: string,
  ): Promise<number> {
    const stored = await this.prismaService.prisma.dailyPrice.aggregate({
      where: { symbolId },
      _min: { date: true },
      _max: { date: true },
    });
    const storedMin = stored._min.date ? formatDateOnly(stored._min.date) : null;
    const storedMax = stored._max.date ? formatDateOnly(stored._max.date) : null;
    const ranges = resolveFetchRanges(from, to, storedMin, storedMax);

    let upserted = 0;
    for (const range of ranges) {
      const bars = await this.provider.fetchDailyBars(ticker, range.from, range.to);
      upserted += await this.upsertBars(symbolId, bars);
    }
    return upserted;
  }

  /** 取得したバーを symbolId+date で upsert し、件数を返す。 */
  private async upsertBars(symbolId: string, bars: DailyBar[]): Promise<number> {
    let upserted = 0;
    for (const bar of bars) {
      await this.prismaService.prisma.dailyPrice.upsert({
        where: {
          symbolId_date: {
            symbolId,
            date: parseDateOnly(bar.date),
          },
        },
        create: {
          symbolId,
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
      upserted += 1;
    }
    return upserted;
  }
}

/**
 * 要求期間と保存済み min/max から、プロバイダへ渡す不足レンジを返す。
 * 中間（min〜max）は取得済みとみなし含めない。
 */
export function resolveFetchRanges(
  requestedFrom: string,
  requestedTo: string,
  storedMin: string | null,
  storedMax: string | null,
): FetchRange[] {
  if (requestedFrom > requestedTo) {
    return [];
  }

  if (!storedMin || !storedMax) {
    return [{ from: requestedFrom, to: requestedTo }];
  }

  const ranges: FetchRange[] = [];
  if (requestedFrom < storedMin) {
    const to = addDays(storedMin, -1);
    if (requestedFrom <= to) {
      ranges.push({ from: requestedFrom, to });
    }
  }
  if (requestedTo > storedMax) {
    const from = addDays(storedMax, 1);
    if (from <= requestedTo) {
      ranges.push({ from, to: requestedTo });
    }
  }
  return ranges;
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
