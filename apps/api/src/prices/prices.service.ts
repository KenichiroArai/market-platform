/**
 * 日足価格の参照サービス。
 *
 * 書き込みは PriceSyncService（外部取得ジョブ）に寄せ、ここは読み取り専用。
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
    const symbol = await this.prismaService.prisma.symbol.findUnique({
      where: { id: symbolId },
    });
    if (!symbol) {
      throw new NotFoundException({
        code: API_ERROR_CODES.SYMBOL_NOT_FOUND,
        message: 'Symbol not found',
      });
    }

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
}
