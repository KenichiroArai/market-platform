/**
 * 日足価格の参照サービス。
 *
 * 書き込みは PriceSyncService（外部取得ジョブ）に寄せ、ここは読み取り専用。
 * テクニカル分析用には lookback 付き取得も提供する。
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { API_ERROR_CODES, type DailyPriceDto } from '@market/shared-types';
import {
  parseDateOnly,
  toDailyPriceDto,
} from '../market-data/market-data.mapper';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PricesService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * 銘柄 ID に紐づく日足を期間フィルタ付きで返す。
   * 銘柄が無ければ SYMBOL_NOT_FOUND。
   */
  async listBySymbolId(
    symbolId: string,
    range?: { from?: string; to?: string },
  ): Promise<DailyPriceDto[]> {
    await this.assertSymbolExists(symbolId);

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

    return rows.map(toDailyPriceDto);
  }

  /**
   * 指標計算用に、表示期間の前に lookback 本の日足を付けて返す。
   *
   * - from があるとき: from より前を最大 lookback 本 + [from, to]
   * - from が無いとき: to までの全履歴（lookback は既に含まれる）
   *
   * 戻り値の bars は計算入力全体。rangeStartIndex はクライアント向けに
   * トリムする先頭インデックス（lookback 区間の直後）。
   */
  async listWithLookback(
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
