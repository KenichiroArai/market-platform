/**
 * 指標セットのビジネスロジック。
 *
 * 所有権は常に userId で絞り、他人のリソースは NOT_FOUND として扱う（存在漏洩を避ける）。
 * 保存するのはカタログ ID のトグル集合と設定 JSON のみ。計算結果は持たない。
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
  validateGroupWeights,
  validateIndicatorParamOverrides,
  validateSignalThresholds,
  type IndicatorSetDto,
} from '@market/shared-types';
import { Prisma } from '@market/database';
import { PrismaService } from '../prisma.service';
import type { CreateIndicatorSetDto, UpdateIndicatorSetDto } from './indicator-sets.dto';
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
      throw this.catalogValidationError(parsed);
    }

    const config = this.parseConfigFields(dto);

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
        indicatorParams: config.indicatorParams as Prisma.InputJsonValue,
        groupWeights:
          config.groupWeights === null
            ? Prisma.DbNull
            : (config.groupWeights as Prisma.InputJsonValue),
        buyThreshold: config.buyThreshold,
        sellThreshold: config.sellThreshold,
      },
    });
    return toIndicatorSetDto(row);
  }

  /** 指標セットを更新する（上書き）。 */
  async update(
    userId: string,
    id: string,
    dto: UpdateIndicatorSetDto,
  ): Promise<IndicatorSetDto> {
    const existing = await this.prismaService.prisma.indicatorSet.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: API_ERROR_CODES.INDICATOR_SET_NOT_FOUND,
        message: 'Indicator set not found',
      });
    }

    const name = dto.name !== undefined ? dto.name.trim() : existing.name;
    if (name.length === 0) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'Name must not be empty',
      });
    }

    let indicatorIds = existing.indicatorIds;
    if (dto.indicatorIds !== undefined) {
      const parsed = parseToggleableCatalogIds(dto.indicatorIds);
      if (!parsed.ok) {
        throw this.catalogValidationError(parsed);
      }
      indicatorIds = parsed.ids;
    }

    const config = this.parseConfigFields({
      indicatorParams:
        dto.indicatorParams ??
        toIndicatorParams((existing as { indicatorParams: unknown }).indicatorParams),
      groupWeights:
        dto.groupWeights !== undefined
          ? dto.groupWeights
          : toNullableGroupWeights((existing as { groupWeights: unknown }).groupWeights),
      buyThreshold:
        dto.buyThreshold !== undefined
          ? dto.buyThreshold
          : (existing as { buyThreshold: number | null }).buyThreshold,
      sellThreshold:
        dto.sellThreshold !== undefined
          ? dto.sellThreshold
          : (existing as { sellThreshold: number | null }).sellThreshold,
    });

    if (name !== existing.name) {
      const conflict = await this.prismaService.prisma.indicatorSet.findFirst({
        where: { userId, name, NOT: { id } },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException({
          code: API_ERROR_CODES.INDICATOR_SET_ALREADY_EXISTS,
          message: 'Indicator set name already exists',
        });
      }
    }

    const row = await this.prismaService.prisma.indicatorSet.update({
      where: { id },
      data: {
        name,
        indicatorIds,
        indicatorParams: config.indicatorParams as Prisma.InputJsonValue,
        groupWeights:
          config.groupWeights === null
            ? Prisma.DbNull
            : (config.groupWeights as Prisma.InputJsonValue),
        buyThreshold: config.buyThreshold,
        sellThreshold: config.sellThreshold,
      },
    });
    return toIndicatorSetDto(row);
  }

  /** 指標セットを削除する。 */
  async remove(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await this.prismaService.prisma.indicatorSet.delete({ where: { id } });
  }

  private parseConfigFields(dto: {
    indicatorParams?: Record<string, Record<string, number>>;
    groupWeights?: Record<string, number> | null;
    buyThreshold?: number | null;
    sellThreshold?: number | null;
  }) {
    const paramsResult = validateIndicatorParamOverrides(dto.indicatorParams ?? {});
    if (!paramsResult.ok) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: `Invalid indicator params: ${paramsResult.detail!}`,
      });
    }

    let groupWeights: Record<string, number> | null = null;
    if (dto.groupWeights != null) {
      const weightsResult = validateGroupWeights(dto.groupWeights);
      if (!weightsResult.ok) {
        throw new UnprocessableEntityException({
          code: API_ERROR_CODES.VALIDATION_FAILED,
          message: `Invalid group weights: ${weightsResult.reason}`,
        });
      }
      groupWeights = weightsResult.weights;
    }

    const buy = dto.buyThreshold ?? null;
    const sell = dto.sellThreshold ?? null;
    if (buy !== null || sell !== null) {
      const thresholdsResult = validateSignalThresholds(
        buy ?? 37.5,
        sell ?? -42.5,
      );
      if (!thresholdsResult.ok) {
        throw new UnprocessableEntityException({
          code: API_ERROR_CODES.VALIDATION_FAILED,
          message: `Invalid signal thresholds: ${thresholdsResult.reason}`,
        });
      }
    }

    return {
      indicatorParams: paramsResult.overrides as Record<string, Record<string, number>>,
      groupWeights,
      buyThreshold: buy,
      sellThreshold: sell,
    };
  }

  private catalogValidationError(parsed: { ok: false; reason: string; token: string }) {
    const message =
      parsed.reason === 'unknown'
        ? `Unknown indicator type: ${parsed.token}`
        : `Indicator is not computable: ${parsed.token}`;
    return new UnprocessableEntityException({
      code: API_ERROR_CODES.VALIDATION_FAILED,
      message,
    });
  }
}

function toIndicatorParams(raw: unknown): Record<string, Record<string, number>> {
  return indicatorParamsFromStored(raw);
}

/** DB 保存済み JSON をパラメータ上書きに正規化する。 */
export function indicatorParamsFromStored(
  raw: unknown,
): Record<string, Record<string, number>> {
  const result = validateIndicatorParamOverrides(raw ?? {});
  return result.ok ? (result.overrides as Record<string, Record<string, number>>) : {};
}

function toNullableGroupWeights(raw: unknown): Record<string, number> | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  return raw as Record<string, number>;
}
