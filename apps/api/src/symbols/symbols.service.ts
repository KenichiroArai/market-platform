/**
 * 銘柄マスタのビジネスロジック。
 *
 * CRUD と一覧取得を担当する。価格同期は PriceSyncService 側。
 */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { API_ERROR_CODES, type SymbolDto } from '@market/shared-types';
import { PrismaService } from '../prisma.service';
import { toSymbolDto } from '../market-data/market-data.mapper';
import type { CreateSymbolDto, UpdateSymbolDto } from './symbols.dto';

@Injectable()
export class SymbolsService {
  constructor(private readonly prismaService: PrismaService) {}

  /** 銘柄一覧。market / isActive で絞り込める。 */
  async list(filters?: {
    market?: 'US' | 'JP';
    isActive?: boolean;
  }): Promise<SymbolDto[]> {
    const rows = await this.prismaService.prisma.symbol.findMany({
      where: {
        market: filters?.market,
        isActive: filters?.isActive,
      },
      orderBy: [{ market: 'asc' }, { ticker: 'asc' }],
    });
    return rows.map(toSymbolDto);
  }

  /** ID で 1 件取得。無ければ SYMBOL_NOT_FOUND。 */
  async getById(id: string): Promise<SymbolDto> {
    const row = await this.prismaService.prisma.symbol.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException({
        code: API_ERROR_CODES.SYMBOL_NOT_FOUND,
        message: 'Symbol not found',
      });
    }
    return toSymbolDto(row);
  }

  /** 新規銘柄を登録。ticker+market 重複は CONFLICT。 */
  async create(dto: CreateSymbolDto): Promise<SymbolDto> {
    const ticker = dto.ticker.trim().toUpperCase();
    const existing = await this.prismaService.prisma.symbol.findUnique({
      where: {
        ticker_market: {
          ticker,
          market: dto.market,
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: API_ERROR_CODES.SYMBOL_ALREADY_EXISTS,
        message: 'Symbol already exists for ticker and market',
      });
    }

    const row = await this.prismaService.prisma.symbol.create({
      data: {
        ticker,
        market: dto.market,
        name: dto.name,
        currency: dto.currency,
        exchange: dto.exchange ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    return toSymbolDto(row);
  }

  /** 部分更新。存在しない ID は SYMBOL_NOT_FOUND。 */
  async update(id: string, dto: UpdateSymbolDto): Promise<SymbolDto> {
    await this.getById(id);

    const row = await this.prismaService.prisma.symbol.update({
      where: { id },
      data: {
        name: dto.name,
        currency: dto.currency,
        exchange: dto.exchange,
        isActive: dto.isActive,
      },
    });
    return toSymbolDto(row);
  }
}
