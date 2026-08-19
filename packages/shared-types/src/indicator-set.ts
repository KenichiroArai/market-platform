/**
 * チャート分析の指標セット API の共有 DTO。
 *
 * ユーザーが複数の名前付きトグル集合を持ち、呼び出しで現行の指標指定へ反映する。
 */

import { isIndicatorCatalogId, type IndicatorCatalogId } from './indicator-catalog';

/** 保存済み指標セット。indicatorIds はカタログ ID（elliott を含まない）。 */
export interface IndicatorSetDto {
  id: string;
  userId: string;
  name: string;
  indicatorIds: IndicatorCatalogId[];
  createdAt: string;
  updatedAt: string;
}

/** 指標セット作成リクエスト。 */
export interface CreateIndicatorSetRequest {
  name: string;
  indicatorIds: IndicatorCatalogId[];
}

/** IndicatorSetDto を組み立てるファクトリ。 */
export function createIndicatorSetDto(input: IndicatorSetDto): IndicatorSetDto {
  return {
    id: input.id,
    userId: input.userId,
    name: input.name,
    indicatorIds: input.indicatorIds,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

/** 未知の JSON が IndicatorSetDto として妥当かを判定する。 */
export function isIndicatorSetDto(value: unknown): value is IndicatorSetDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.userId !== 'string' ||
    typeof record.name !== 'string' ||
    !Array.isArray(record.indicatorIds) ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    return false;
  }

  return record.indicatorIds.every((id) => isIndicatorCatalogId(id));
}
