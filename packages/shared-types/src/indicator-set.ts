/**
 * チャート分析の指標セット API の共有 DTO。
 *
 * ユーザーが複数の名前付きトグル集合を持ち、呼び出しで現行の指標指定へ反映する。
 * v0.4.0 Ph2 以降はパラメータ上書き・スコア配点・閾値も永続化する（ADR 014）。
 */

import { isIndicatorCatalogId, type IndicatorCatalogId } from './indicator-catalog';
import type { IndicatorParamOverrides } from './indicator-param-rules';
import type { GroupWeights } from './indicator-score-config';

/** 保存済み指標セット。indicatorIds はカタログ ID（elliott を含まない）。 */
export interface IndicatorSetDto {
  id: string;
  userId: string;
  name: string;
  indicatorIds: IndicatorCatalogId[];
  /** カタログ既定からのパラメータ差分。 */
  indicatorParams: IndicatorParamOverrides;
  /** 6 グループ配点。null は ADR 007 既定。 */
  groupWeights: GroupWeights | null;
  buyThreshold: number | null;
  sellThreshold: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 指標セット作成リクエスト。 */
export interface CreateIndicatorSetRequest {
  name: string;
  indicatorIds: IndicatorCatalogId[];
  indicatorParams?: IndicatorParamOverrides;
  groupWeights?: GroupWeights | null;
  buyThreshold?: number | null;
  sellThreshold?: number | null;
}

/** 指標セット更新リクエスト（PATCH）。 */
export interface UpdateIndicatorSetRequest {
  name?: string;
  indicatorIds?: IndicatorCatalogId[];
  indicatorParams?: IndicatorParamOverrides;
  groupWeights?: GroupWeights | null;
  buyThreshold?: number | null;
  sellThreshold?: number | null;
}

/** IndicatorSetDto を組み立てるファクトリ。 */
export function createIndicatorSetDto(input: IndicatorSetDto): IndicatorSetDto {
  return {
    id: input.id,
    userId: input.userId,
    name: input.name,
    indicatorIds: input.indicatorIds,
    indicatorParams: input.indicatorParams,
    groupWeights: input.groupWeights,
    buyThreshold: input.buyThreshold,
    sellThreshold: input.sellThreshold,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isIndicatorParamsRecord(value: unknown): value is IndicatorParamOverrides {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  for (const [id, params] of Object.entries(value as Record<string, unknown>)) {
    if (!isIndicatorCatalogId(id)) {
      return false;
    }
    if (params === null || typeof params !== 'object' || Array.isArray(params)) {
      return false;
    }
    for (const paramValue of Object.values(params as Record<string, unknown>)) {
      if (typeof paramValue !== 'number' || !Number.isFinite(paramValue)) {
        return false;
      }
    }
  }
  return true;
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

  if (!record.indicatorIds.every((id) => isIndicatorCatalogId(id))) {
    return false;
  }

  const params = record.indicatorParams ?? {};
  if (!isIndicatorParamsRecord(params)) {
    return false;
  }

  if (record.groupWeights !== null && record.groupWeights !== undefined) {
    if (typeof record.groupWeights !== 'object' || Array.isArray(record.groupWeights)) {
      return false;
    }
  }

  if (!isNullableNumber(record.buyThreshold) || !isNullableNumber(record.sellThreshold)) {
    return false;
  }

  return true;
}
