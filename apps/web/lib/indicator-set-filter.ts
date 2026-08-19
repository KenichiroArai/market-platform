/**
 * 指標セット一覧のクライアント側検索。
 *
 * 専用検索 API は作らず、GET した全件をここで絞る。
 * セット名は部分一致（大文字小文字無視）。指標チェックは AND（すべて含む）。
 */

import type { IndicatorCatalogId, IndicatorSetDto } from '@market/shared-types';

/** 名前クエリと必須指標でセットを絞り込む。 */
export function filterIndicatorSets(
  sets: IndicatorSetDto[],
  nameQuery: string,
  requiredIds: ReadonlySet<IndicatorCatalogId>,
): IndicatorSetDto[] {
  const q = nameQuery.trim().toLowerCase();
  return sets.filter((set) => {
    if (q.length > 0 && !set.name.toLowerCase().includes(q)) {
      return false;
    }
    for (const id of requiredIds) {
      if (!set.indicatorIds.includes(id)) {
        return false;
      }
    }
    return true;
  });
}
