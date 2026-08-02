/**
 * 日足価格の参照サービス。
 *
 * 書き込みは PriceSyncService（外部取得ジョブ）に寄せ、ここは読み取り専用。
 * テクニカル分析用には lookback 付き取得も提供する。
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
  parseDateOnly,
  toDailyPriceDto,
} from '../market-data/market-data.mapper';
import { PrismaService } from '../prisma.service';

/** 週足 lookback 用: 1 週あたりの概算取引日数（余裕込み）。 */
const TRADING_DAYS_PER_WEEK = 5;

@Injectable()
export class PricesService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * 銘柄 ID に紐づく価格を期間・足種フィルタ付きで返す。
   * interval=1w のときは日足取得後に週集約する。
   * 銘柄が無ければ SYMBOL_NOT_FOUND。
   */
  async listBySymbolId(
    symbolId: string,
    range?: { from?: string; to?: string; interval?: ChartInterval },
  ): Promise<DailyPriceDto[]> {
    await this.assertSymbolExists(symbolId);

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
}
