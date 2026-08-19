/**
 * 指標セットのビジネスロジック。
 *
 * 所有権は常に userId で絞り、他人のリソースは NOT_FOUND として扱う（存在漏洩を避ける）。
 * 保存するのはカタログ ID のトグル集合のみ。計算結果は持たない。
 */
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  API_ERROR_CODES,
  parseToggleableCatalogIds,
  type IndicatorSetDto,
} from '@market/shared-types';
import { PrismaService } from '../prisma.service';
import type { CreateIndicatorSetDto } from './indicator-sets.dto';
import { toIndicatorSetDto } from './indicator-sets.mapper';

@Injectable()
export class IndicatorSetsService {
  constructor(private readonly prismaService: PrismaService) {}

  /** 自分の指標セット一覧（作成順）。 */
  async list(userId: string): Promise<IndicatorSetDto[]> {
    const rows = await this.prismaService.prisma.indicatorSet.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toIndicatorSetDto);
  }

  /** ID で 1 件取得。所有者以外は NOT_FOUND。 */
  async getById(userId: string, id: string): Promise<IndicatorSetDto> {
    const row = await this.prismaService.prisma.indicatorSet.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException({
        code: API_ERROR_CODES.INDICATOR_SET_NOT_FOUND,
        message: 'Indicator set not found',
      });
    }
    return toIndicatorSetDto(row);
  }

  /** 新規セットを作成する。名前重複は CONFLICT。未知 ID / エリオットは VALIDATION_FAILED。 */
  async create(userId: string, dto: CreateIndicatorSetDto): Promise<IndicatorSetDto> {
    const name = dto.name.trim();
    const parsed = parseToggleableCatalogIds(dto.indicatorIds);
    if (!parsed.ok) {
      const message =
        parsed.reason === 'unknown'
          ? `Unknown indicator type: ${parsed.token}`
          : `Indicator is not computable: ${parsed.token}`;
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message,
      });
    }

    const existing = await this.prismaService.prisma.indicatorSet.findFirst({
      where: { userId, name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: API_ERROR_CODES.INDICATOR_SET_ALREADY_EXISTS,
        message: 'Indicator set name already exists',
      });
    }

    const row = await this.prismaService.prisma.indicatorSet.create({
      data: {
        userId,
        name,
        indicatorIds: parsed.ids,
      },
    });
    return toIndicatorSetDto(row);
  }

  /** 指標セットを削除する。 */
  async remove(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.prismaService.prisma.indicatorSet.delete({ where: { id } });
  }
}
