/**
 * 価格取得ジョブのオーケストレーション。
 *
 * アクティブ銘柄（または指定 ID）を走査し、MarketDataProvider から日足を取得して upsert する。
 * 保存済み min〜max の外側（ギャップ）に加え、要求期間末尾の lookback 日は常に再取得して上書きする。
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
   * forceRefresh 時は要求期間全体を再取得して上書きする。
   */
  async syncPrices(options?: {
    symbolIds?: string[];
    from?: string;
    to?: string;
    forceRefresh?: boolean;
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
        upsertedBars += await this.syncSymbol(
          symbol.id,
          symbol.ticker,
          from,
          to,
          lookbackDays,
          options?.forceRefresh === true,
        );
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
   * 1 銘柄について不足期間と直近ウィンドウ（または全体）を取り、upsert した本数を返す。
   */
  private async syncSymbol(
    symbolId: string,
    ticker: string,
    from: string,
    to: string,
    lookbackDays: number,
    forceRefresh: boolean,
  ): Promise<number> {
    if (from > to) {
      return 0;
    }

    let ranges: FetchRange[];
    if (forceRefresh) {
      ranges = [{ from, to }];
    } else {
      const stored = await this.prismaService.prisma.dailyPrice.aggregate({
        where: { symbolId },
        _min: { date: true },
        _max: { date: true },
      });
      const storedMin = stored._min.date ? formatDateOnly(stored._min.date) : null;
      const storedMax = stored._max.date ? formatDateOnly(stored._max.date) : null;
      ranges = resolveFetchRangesWithRefresh(
        from,
        to,
        storedMin,
        storedMax,
        lookbackDays,
      );
    }

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

/**
 * ギャップ埋めに加え、要求期間末尾の refreshDays を必ず再取得対象にする。
 */
export function resolveFetchRangesWithRefresh(
  requestedFrom: string,
  requestedTo: string,
  storedMin: string | null,
  storedMax: string | null,
  refreshDays: number,
): FetchRange[] {
  const ranges = resolveFetchRanges(requestedFrom, requestedTo, storedMin, storedMax);
  if (requestedFrom > requestedTo || refreshDays <= 0) {
    return ranges;
  }
  const refreshStartCandidate = addDays(requestedTo, -(refreshDays - 1));
  const refreshFrom =
    refreshStartCandidate < requestedFrom ? requestedFrom : refreshStartCandidate;
  return mergeFetchRanges(ranges, { from: refreshFrom, to: requestedTo });
}

/** 重複・隣接する期間をまとめる。 */
export function mergeFetchRanges(ranges: FetchRange[], extra: FetchRange): FetchRange[] {
  const all = [...ranges, extra].filter((r) => r.from <= r.to);
  if (all.length === 0) {
    return [];
  }
  all.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const merged: FetchRange[] = [{ ...all[0]! }];
  for (let i = 1; i < all.length; i += 1) {
    const current = all[i]!;
    const last = merged[merged.length - 1]!;
    if (current.from <= addDays(last.to, 1)) {
      if (current.to > last.to) {
        last.to = current.to;
      }
      continue;
    }
    merged.push({ ...current });
  }
  return merged;
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
