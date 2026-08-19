/**
 * Prisma IndicatorSet 行を共有 DTO に変換するヘルパー。
 */
import {
  createIndicatorSetDto,
  parseToggleableCatalogIds,
  type IndicatorCatalogId,
  type IndicatorSetDto,
} from '@market/shared-types';

/** Prisma IndicatorSet の最小形。 */
export type IndicatorSetRow = {
  id: string;
  userId: string;
  name: string;
  indicatorIds: string[];
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
  // 1 件でも不正なら、残りの正当な ID だけ残す
  const recovered = parseToggleableCatalogIds(raw.filter((id) => id !== parsed.token));
  return recovered.ok ? recovered.ids : [];
}

/** IndicatorSet 行を DTO に変換する。 */
export function toIndicatorSetDto(row: IndicatorSetRow): IndicatorSetDto {
  return createIndicatorSetDto({
    id: row.id,
    userId: row.userId,
    name: row.name,
    indicatorIds: toSavedIndicatorIds(row.indicatorIds),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
