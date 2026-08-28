/**
 * Prisma IndicatorSet 行を共有 DTO に変換するヘルパー。
 */
import type { Prisma } from '@market/database';
import {
  createIndicatorSetDto,
  parseToggleableCatalogIds,
  sanitizePartialGroupWeights,
  type GroupWeights,
  type IndicatorCatalogId,
  type IndicatorCategoryId,
  type IndicatorParamOverrides,
  type IndicatorSetDto,
} from '@market/shared-types';

/** Prisma IndicatorSet の最小形。 */
export type IndicatorSetRow = {
  id: string;
  userId: string;
  name: string;
  indicatorIds: string[];
  indicatorParams: Prisma.JsonValue;
  groupWeights: Prisma.JsonValue | null;
  buyThreshold: number | null;
  sellThreshold: number | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * DB の文字列配列をトグル可能なカタログ ID にする。
 * 未知・エリオットは読み取り時に落とす（保存時に弾いているが、古い行の保険）。
 */
export function toSavedIndicatorIds(raw: string[]): IndicatorCatalogId[] {
  const parsed = parseToggleableCatalogIds(raw);
  if (parsed.ok) {
    return parsed.ids;
  }
  const recovered = parseToggleableCatalogIds(raw.filter((id) => id !== parsed.token));
  return recovered.ok ? recovered.ids : [];
}

function toIndicatorParams(raw: Prisma.JsonValue): IndicatorParamOverrides {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result: IndicatorParamOverrides = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const params: Record<string, number> = {};
      for (const [paramKey, paramValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof paramValue === 'number' && Number.isFinite(paramValue)) {
          params[paramKey] = paramValue;
        }
      }
      if (Object.keys(params).length > 0) {
        result[key as IndicatorCatalogId] = params;
      }
    }
  }
  return result;
}

function toGroupWeights(raw: Prisma.JsonValue | null): GroupWeights | null {
  if (raw === null) {
    return null;
  }
  const partial = sanitizePartialGroupWeights(raw);
  if (!partial) {
    return null;
  }
  const keys = Object.keys(partial) as IndicatorCategoryId[];
  if (keys.length !== 6) {
    return null;
  }
  return partial as GroupWeights;
}

/** IndicatorSet 行を DTO に変換する。 */
export function toIndicatorSetDto(row: IndicatorSetRow): IndicatorSetDto {
  return createIndicatorSetDto({
    id: row.id,
    userId: row.userId,
    name: row.name,
    indicatorIds: toSavedIndicatorIds(row.indicatorIds),
    indicatorParams: toIndicatorParams(row.indicatorParams),
    groupWeights: toGroupWeights(row.groupWeights),
    buyThreshold: row.buyThreshold,
    sellThreshold: row.sellThreshold,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
