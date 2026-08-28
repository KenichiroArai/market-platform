/**
 * 有効指標からバックテスト用シグナル規則のプレビュー文を組み立てる。
 *
 * ページ本体は istanbul-ignore しうるため、説明文生成をここに切り出す。
 */

import { describeSignalRule, type IndicatorCatalogId, type IndicatorParamOverrides } from '@market/shared-types';

/** enabledIds（配列または Set）から UI 表示用の説明文を返す。 */
export function signalRulePreviewText(
  ids: readonly IndicatorCatalogId[] | ReadonlySet<IndicatorCatalogId>,
  paramOverrides?: IndicatorParamOverrides | null,
): string {
  return describeSignalRule(ids, paramOverrides);
}
