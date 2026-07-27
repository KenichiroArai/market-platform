/**
 * ポートフォリオのビジネスロジック。
 *
 * 所有権は常に userId で絞る。評価額は各銘柄の最新日足終値から算出し、通貨別に集計する。
 */
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { API_ERROR_CODES, type PortfolioDto } from '@market/shared-types';
import { PrismaService } from '../prisma.service';
import type {
  AddPortfolioHoldingDto,
  CreatePortfolioDto,
  UpdatePortfolioDto,
  UpdatePortfolioHoldingDto,
} from './portfolios.dto';
import { toPortfolioDto, type PortfolioRow } from './portfolios.mapper';

/** holdings.symbol を常に含める include。 */
const portfolioInclude = {
  holdings: {
    include: { symbol: true },
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class PortfoliosService {
  constructor(private readonly prismaService: PrismaService) {}

  /** 自分のポートフォリオ一覧（集計付き）。 */
  async list(userId: string): Promise<PortfolioDto[]> {
    const rows = await this.prismaService.prisma.portfolio.findMany({
      where: { userId },
      include: portfolioInclude,
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(rows.map((row) => this.toDtoWithPrices(row)));
  }

  /** ID で 1 件取得。所有者以外は NOT_FOUND。 */
  async getById(userId: string, id: string): Promise<PortfolioDto> {
    const row = await this.findOwned(userId, id);
    return this.toDtoWithPrices(row);
  }

  /** 新規ポートフォリオを作成する。 */
  async create(userId: string, dto: CreatePortfolioDto): Promise<PortfolioDto> {
    const row = await this.prismaService.prisma.portfolio.create({
      data: {
        userId,
        name: dto.name.trim(),
      },
      include: portfolioInclude,
    });
    return this.toDtoWithPrices(row);
  }

  /** 名前を部分更新する。 */
  async update(
    userId: string,
    id: string,
    dto: UpdatePortfolioDto,
  ): Promise<PortfolioDto> {
    await this.findOwned(userId, id);
    const row = await this.prismaService.prisma.portfolio.update({
      where: { id },
      data: {
        name: dto.name === undefined ? undefined : dto.name.trim(),
      },
      include: portfolioInclude,
    });
    return this.toDtoWithPrices(row);
  }

  /** ポートフォリオを削除する（holdings は Cascade）。 */
  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prismaService.prisma.portfolio.delete({ where: { id } });
  }

  /** 保有を追加する。 */
  async addHolding(
    userId: string,
    portfolioId: string,
    dto: AddPortfolioHoldingDto,
  ): Promise<PortfolioDto> {
    await this.findOwned(userId, portfolioId);

    const symbol = await this.prismaService.prisma.symbol.findUnique({
      where: { id: dto.symbolId },
    });
    if (!symbol) {
      throw new NotFoundException({
        code: API_ERROR_CODES.SYMBOL_NOT_FOUND,
        message: 'Symbol not found',
      });
    }

    const existing = await this.prismaService.prisma.portfolioHolding.findUnique({
      where: {
        portfolioId_symbolId: {
          portfolioId,
          symbolId: dto.symbolId,
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: API_ERROR_CODES.HOLDING_ALREADY_EXISTS,
        message: 'Holding already exists for symbol',
      });
    }

    await this.prismaService.prisma.portfolioHolding.create({
      data: {
        portfolioId,
        symbolId: dto.symbolId,
        quantity: dto.quantity,
        averageCost: dto.averageCost,
      },
    });

    return this.getById(userId, portfolioId);
  }

  /** 保有の quantity / averageCost を部分更新する。 */
  async updateHolding(
    userId: string,
    portfolioId: string,
    holdingId: string,
    dto: UpdatePortfolioHoldingDto,
  ): Promise<PortfolioDto> {
    await this.findOwned(userId, portfolioId);

    const holding = await this.prismaService.prisma.portfolioHolding.findFirst({
      where: { id: holdingId, portfolioId },
    });
    if (!holding) {
      throw new NotFoundException({
        code: API_ERROR_CODES.HOLDING_NOT_FOUND,
        message: 'Holding not found',
      });
    }

    await this.prismaService.prisma.portfolioHolding.update({
      where: { id: holdingId },
      data: {
        quantity: dto.quantity,
        averageCost: dto.averageCost,
      },
    });

    return this.getById(userId, portfolioId);
  }

  /** 保有を削除する。 */
  async removeHolding(
    userId: string,
    portfolioId: string,
    holdingId: string,
  ): Promise<PortfolioDto> {
    await this.findOwned(userId, portfolioId);

    const holding = await this.prismaService.prisma.portfolioHolding.findFirst({
      where: { id: holdingId, portfolioId },
    });
    if (!holding) {
      throw new NotFoundException({
        code: API_ERROR_CODES.HOLDING_NOT_FOUND,
        message: 'Holding not found',
      });
    }

    await this.prismaService.prisma.portfolioHolding.delete({ where: { id: holdingId } });
    return this.getById(userId, portfolioId);
  }

  /** 所有者のポートフォリオ行を取得する。無ければ NOT_FOUND。 */
  private async findOwned(userId: string, id: string): Promise<PortfolioRow> {
    const row = await this.prismaService.prisma.portfolio.findFirst({
      where: { id, userId },
      include: portfolioInclude,
    });
    if (!row) {
      throw new NotFoundException({
        code: API_ERROR_CODES.PORTFOLIO_NOT_FOUND,
        message: 'Portfolio not found',
      });
    }
    return row;
  }

  /**
   * 保有銘柄の最新終値をまとめて取得し、DTO に変換する。
   * 価格が無い銘柄は Map に載せない（mapper 側で null になる）。
   */
  private async toDtoWithPrices(row: PortfolioRow): Promise<PortfolioDto> {
    const symbolIds = [...new Set(row.holdings.map((h) => h.symbolId))];
    const latestCloseBySymbolId = await this.loadLatestCloses(symbolIds);
    return toPortfolioDto(row, latestCloseBySymbolId);
  }

  /** 各 symbolId の最新日の close を Map で返す。 */
  private async loadLatestCloses(symbolIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (symbolIds.length === 0) {
      return result;
    }

    // 銘柄ごとに最新日 1 件を取る。件数が少ない Phase 3 想定のため N 回クエリで十分。
    await Promise.all(
      symbolIds.map(async (symbolId) => {
        const price = await this.prismaService.prisma.dailyPrice.findFirst({
          where: { symbolId },
          orderBy: { date: 'desc' },
        });
        if (price) {
          result.set(symbolId, Number(price.close.toString()));
        }
      }),
    );

    return result;
  }
}
