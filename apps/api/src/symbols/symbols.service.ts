/**
 * 銘柄マスタのビジネスロジック。
 *
 * 作成はティッカー + 市場を受け、quote でメタデータを埋めてから登録する。
 * 初回の日足同期は PriceSyncService に委譲する（失敗しても銘柄行は残す）。
 */
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { API_ERROR_CODES, type SymbolDto } from '@market/shared-types';
import { PrismaService } from '../prisma.service';
import { toSymbolDto } from '../market-data/market-data.mapper';
import { PriceSyncService } from '../market-data/price-sync.service';
import type { MarketDataProvider } from '../market-data/providers/market-data.provider';
import { MARKET_DATA_PROVIDER } from '../market-data/providers/provider.token';
import type { CreateSymbolDto, UpdateSymbolDto } from './symbols.dto';

@Injectable()
export class SymbolsService {
  private readonly logger = new Logger(SymbolsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly priceSyncService: PriceSyncService,
    @Inject(MARKET_DATA_PROVIDER)
    private readonly provider: MarketDataProvider,
  ) {}

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

  /**
   * 新規銘柄を登録する。
   * ticker+market 重複は CONFLICT。quote 失敗は SYMBOL_QUOTE_NOT_FOUND。
   */
  async create(dto: CreateSymbolDto): Promise<SymbolDto> {
    const ticker = normalizeTicker(dto.ticker, dto.market);
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

    let quote;
    try {
      quote = await this.provider.fetchQuote(ticker);
    } catch {
      throw new NotFoundException({
        code: API_ERROR_CODES.SYMBOL_QUOTE_NOT_FOUND,
        message: 'Symbol quote not found',
      });
    }

    const row = await this.prismaService.prisma.symbol.create({
      data: {
        ticker,
        market: dto.market,
        name: quote.name,
        currency: quote.currency,
        exchange: quote.exchange,
        isActive: true,
      },
    });

    // 初回同期の失敗は銘柄登録自体は成功させる（期間付き GET で後から埋まる）
    try {
      await this.priceSyncService.syncPrices({ symbolIds: [row.id] });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'Unknown sync error';
      this.logger.warn(`Initial price sync failed for ${ticker}: ${reason}`);
    }

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

/**
 * ティッカーを Yahoo 形式に正規化する。
 * JP で `.T` が無ければ付与する（7203 → 7203.T）。
 */
export function normalizeTicker(ticker: string, market: 'US' | 'JP'): string {
  const trimmed = ticker.trim().toUpperCase();
  if (market === 'JP' && !trimmed.endsWith('.T')) {
    return `${trimmed}.T`;
  }
  return trimmed;
}
