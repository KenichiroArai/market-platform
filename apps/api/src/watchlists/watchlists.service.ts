/**
 * ウォッチリストのビジネスロジック。
 *
 * 所有権は常に userId で絞り、他人のリソースは NOT_FOUND として扱う（存在漏洩を避ける）。
 */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { API_ERROR_CODES, type WatchlistDto } from '@market/shared-types';
import { PrismaService } from '../prisma.service';
import type {
  AddWatchlistItemDto,
  CreateWatchlistDto,
  UpdateWatchlistDto,
} from './watchlists.dto';
import { toWatchlistDto } from './watchlists.mapper';

/** items.symbol を常に含める include。 */
const watchlistInclude = {
  items: {
    include: { symbol: true },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class WatchlistsService {
  constructor(private readonly prismaService: PrismaService) {}

  /** 自分のウォッチリスト一覧。 */
  async list(userId: string): Promise<WatchlistDto[]> {
    const rows = await this.prismaService.prisma.watchlist.findMany({
      where: { userId },
      include: watchlistInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toWatchlistDto);
  }

  /** ID で 1 件取得。所有者以外は NOT_FOUND。 */
  async getById(userId: string, id: string): Promise<WatchlistDto> {
    const row = await this.prismaService.prisma.watchlist.findFirst({
      where: { id, userId },
      include: watchlistInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: API_ERROR_CODES.WATCHLIST_NOT_FOUND,
        message: 'Watchlist not found',
      });
    }
    return toWatchlistDto(row);
  }

  /** 新規ウォッチリストを作成する。 */
  async create(userId: string, dto: CreateWatchlistDto): Promise<WatchlistDto> {
    const row = await this.prismaService.prisma.watchlist.create({
      data: {
        userId,
        name: dto.name.trim(),
      },
      include: watchlistInclude,
    });
    return toWatchlistDto(row);
  }

  /** 名前を部分更新する。 */
  async update(
    userId: string,
    id: string,
    dto: UpdateWatchlistDto,
  ): Promise<WatchlistDto> {
    await this.getById(userId, id);
    const row = await this.prismaService.prisma.watchlist.update({
      where: { id },
      data: {
        name: dto.name === undefined ? undefined : dto.name.trim(),
      },
      include: watchlistInclude,
    });
    return toWatchlistDto(row);
  }

  /** ウォッチリストを削除する（items は Cascade）。 */
  async remove(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.prismaService.prisma.watchlist.delete({ where: { id } });
  }

  /** 銘柄を追加する。重複は CONFLICT。存在しない銘柄は SYMBOL_NOT_FOUND。 */
  async addItem(
    userId: string,
    watchlistId: string,
    dto: AddWatchlistItemDto,
  ): Promise<WatchlistDto> {
    await this.getById(userId, watchlistId);

    const symbol = await this.prismaService.prisma.symbol.findUnique({
      where: { id: dto.symbolId },
    });
    if (!symbol) {
      throw new NotFoundException({
        code: API_ERROR_CODES.SYMBOL_NOT_FOUND,
        message: 'Symbol not found',
      });
    }

    const existing = await this.prismaService.prisma.watchlistItem.findUnique({
      where: {
        watchlistId_symbolId: {
          watchlistId,
          symbolId: dto.symbolId,
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: API_ERROR_CODES.WATCHLIST_ITEM_ALREADY_EXISTS,
        message: 'Symbol already in watchlist',
      });
    }

    await this.prismaService.prisma.watchlistItem.create({
      data: {
        watchlistId,
        symbolId: dto.symbolId,
      },
    });

    return this.getById(userId, watchlistId);
  }

  /** 銘柄行を削除する。 */
  async removeItem(
    userId: string,
    watchlistId: string,
    itemId: string,
  ): Promise<WatchlistDto> {
    await this.getById(userId, watchlistId);

    const item = await this.prismaService.prisma.watchlistItem.findFirst({
      where: { id: itemId, watchlistId },
    });
    if (!item) {
      throw new NotFoundException({
        code: API_ERROR_CODES.WATCHLIST_ITEM_NOT_FOUND,
        message: 'Watchlist item not found',
      });
    }

    await this.prismaService.prisma.watchlistItem.delete({ where: { id: itemId } });
    return this.getById(userId, watchlistId);
  }
}
