/**
 * 日足価格の参照サービス。
 *
 * 永続化（upsert）は PriceSyncService に寄せる。期間付き読み取りでは
 * 不足期間の差分取得を先に依頼してから SELECT する。
 * 週足は DB に持たず、日足取得後に集約する（ADR 005）。
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  aggregateDailyBarsToWeekly,
  API_ERROR_CODES,
  type ChartInterval,
  type DailyPriceDto,
} from '@market/shared-types';
import {
  addDays,
  lookbackFromDate,
  parseDateOnly,
  toDailyPriceDto,
  todayDateOnly,
} from '../market-data/market-data.mapper';
import { PriceSyncService, resolveLookbackDays } from '../market-data/price-sync.service';
import { PrismaService } from '../prisma.service';

/** 週足 lookback 用: 1 週あたりの概算取引日数（余裕込み）。 */
const TRADING_DAYS_PER_WEEK = 5;

@Injectable()
export class PricesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly priceSyncService: PriceSyncService,
  ) {}

  /**
   * 銘柄 ID に紐づく価格を期間・足種フィルタ付きで返す。
   * interval=1w のときは日足取得後に週集約する。
   * 銘柄が無ければ SYMBOL_NOT_FOUND。
   * from / to があるときは不足期間を差分取得してから返す。
   */
  async listBySymbolId(
    symbolId: string,
    range?: { from?: string; to?: string; interval?: ChartInterval },
  ): Promise<DailyPriceDto[]> {
    await this.assertSymbolExists(symbolId);
    await this.ensureCoverage(symbolId, { from: range?.from, to: range?.to });

    const interval = range?.interval ?? '1d';
    const rows = await this.prismaService.prisma.dailyPrice.findMany({
      where: {
        symbolId,
        date: {
          gte: range?.from ? parseDateOnly(range.from) : undefined,
          lte: range?.to ? parseDateOnly(range.to) : undefined,
        },
      },
      orderBy: { date: 'asc' },
    });

    const daily = rows.map(toDailyPriceDto);
    return interval === '1w' ? aggregateDailyBarsToWeekly(daily) : daily;
  }

  /**
   * 指標計算用に、表示期間の前に lookback 本のバーを付けて返す。
   *
   * - interval=1d: lookback は日足本数（従来どおり）
   * - interval=1w: lookback は週バー本数。日足を多めに読み → 週集約し、
   *   rangeStartIndex は集約後の週バー列上のインデックス
   *
   * 戻り値の bars は計算入力全体（日足または週足）。rangeStartIndex は
   * クライアント向けにトリムする先頭インデックス（lookback 区間の直後）。
   */
  async listWithLookback(
    symbolId: string,
    options: {
      from?: string;
      to?: string;
      lookback: number;
      interval?: ChartInterval;
    },
  ): Promise<{ bars: DailyPriceDto[]; rangeStartIndex: number }> {
    const interval = options.interval ?? '1d';
    // 指標ウォームアップ用に from を lookback 分だけ前倒しして不足期間を埋める
    const extraLookbackDays = interval === '1w' ? options.lookback * 7 : options.lookback;
    await this.assertSymbolExists(symbolId);
    await this.ensureCoverage(symbolId, {
      from: options.from,
      to: options.to,
      extraLookbackDays,
    });
    if (interval === '1w') {
      return this.listWeeklyWithLookback(symbolId, options);
    }
    return this.listDailyWithLookback(symbolId, options);
  }

  /** 日足の lookback 付き取得（従来ロジック）。 */
  private async listDailyWithLookback(
    symbolId: string,
    options: { from?: string; to?: string; lookback: number },
  ): Promise<{ bars: DailyPriceDto[]; rangeStartIndex: number }> {
    await this.assertSymbolExists(symbolId);

    const { from, to, lookback } = options;
    const toDate = to ? parseDateOnly(to) : undefined;

    if (!from) {
      const rows = await this.prismaService.prisma.dailyPrice.findMany({
        where: {
          symbolId,
          date: { lte: toDate },
        },
        orderBy: { date: 'asc' },
      });
      return { bars: rows.map(toDailyPriceDto), rangeStartIndex: 0 };
    }

    const fromDate = parseDateOnly(from);

    // 表示期間より前のウォームアップ用バー（新しい順に take → 昇順へ戻す）
    const priorRows =
      lookback > 0
        ? await this.prismaService.prisma.dailyPrice.findMany({
            where: {
              symbolId,
              date: { lt: fromDate },
            },
            orderBy: { date: 'desc' },
            take: lookback,
          })
        : [];
    priorRows.reverse();

    const rangeRows = await this.prismaService.prisma.dailyPrice.findMany({
      where: {
        symbolId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    return {
      bars: [...priorRows, ...rangeRows].map(toDailyPriceDto),
      rangeStartIndex: priorRows.length,
    };
  }

  /**
   * 週足の lookback 付き取得。
   * 日足を十分読み、週集約したうえで from 以降の最初の週を rangeStartIndex にする。
   */
  private async listWeeklyWithLookback(
    symbolId: string,
    options: { from?: string; to?: string; lookback: number },
  ): Promise<{ bars: DailyPriceDto[]; rangeStartIndex: number }> {
    await this.assertSymbolExists(symbolId);

    const { from, to, lookback } = options;
    const toDate = to ? parseDateOnly(to) : undefined;

    // from より前に lookback 週分の日足が必要なので、概算取引日数で多めに取る
    const priorDailyTake = lookback > 0 ? lookback * TRADING_DAYS_PER_WEEK : 0;

    if (!from) {
      const rows = await this.prismaService.prisma.dailyPrice.findMany({
        where: {
          symbolId,
          date: { lte: toDate },
        },
        orderBy: { date: 'asc' },
      });
      const weekly = aggregateDailyBarsToWeekly(rows.map(toDailyPriceDto));
      return { bars: weekly, rangeStartIndex: 0 };
    }

    const fromDate = parseDateOnly(from);

    let priorDaily: DailyPriceDto[] = [];
    if (priorDailyTake > 0) {
      const priorRows = await this.prismaService.prisma.dailyPrice.findMany({
        where: {
          symbolId,
          date: { lt: fromDate },
        },
        orderBy: { date: 'desc' },
        take: priorDailyTake,
      });
      priorRows.reverse();
      priorDaily = priorRows.map(toDailyPriceDto);
    }

    const rangeRows = await this.prismaService.prisma.dailyPrice.findMany({
      where: {
        symbolId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { date: 'asc' },
    });
    const rangeDaily = rangeRows.map(toDailyPriceDto);

    const weekly = aggregateDailyBarsToWeekly([...priorDaily, ...rangeDaily]);

    // from 以降の最初の週バーの位置（日付キーが from 以上）
    const rangeStartIndex = weekly.findIndex((bar) => bar.date >= from);
    return {
      bars: weekly,
      rangeStartIndex: rangeStartIndex < 0 ? weekly.length : rangeStartIndex,
    };
  }

  /** 銘柄の存在確認。無ければ SYMBOL_NOT_FOUND。 */
  private async assertSymbolExists(symbolId: string): Promise<void> {
    const symbol = await this.prismaService.prisma.symbol.findUnique({
      where: { id: symbolId },
    });
    if (!symbol) {
      throw new NotFoundException({
        code: API_ERROR_CODES.SYMBOL_NOT_FOUND,
        message: 'Symbol not found',
      });
    }
  }

  /**
   * 期間指定があるときだけ同期を先に走らせる。
   * 要求期間は forceRefresh で上書きし、同一キーは短時間スキップする（チャート多重取得対策）。
   */
  private readonly coverageSyncedAt = new Map<string, number>();

  private async ensureCoverage(
    symbolId: string,
    range?: { from?: string; to?: string; extraLookbackDays?: number },
  ): Promise<void> {
    if (!range?.from && !range?.to) {
      return;
    }

    const lookbackDays = resolveLookbackDays(process.env.MARKET_DATA_LOOKBACK_DAYS);
    const fromBase = range.from ?? lookbackFromDate(lookbackDays);
    const extra = range.extraLookbackDays ?? 0;
    const from = extra > 0 ? addDays(fromBase, -extra) : fromBase;
    const to = range.to ?? todayDateOnly();
    if (from > to) {
      return;
    }

    const cacheKey = `${symbolId}:${from}:${to}`;
    const now = Date.now();
    const last = this.coverageSyncedAt.get(cacheKey) ?? 0;
    if (now - last < 60_000) {
      return;
    }
    this.coverageSyncedAt.set(cacheKey, now);

    await this.priceSyncService.syncPrices({
      symbolIds: [symbolId],
      from,
      to,
      forceRefresh: true,
    });
  }
}
