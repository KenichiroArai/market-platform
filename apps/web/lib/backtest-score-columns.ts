/**
 * バックテストのスコア内訳列定義（取引表・日次表・CSV 共用）。
 *
 * グループ列は INDICATOR_CATEGORIES の nameJa（末尾「系」を省略）、
 * 指標列は scoringCatalogIds の短い系列ラベルを使う。
 */

import {
  formatDecisionScore,
  INDICATOR_CATALOG_BY_ID,
  INDICATOR_CATEGORIES,
  scoreGroupCategoryIds,
  scoringCatalogIds,
  type BacktestScoreBreakdown,
  type IndicatorCatalogId,
  type IndicatorCategoryId,
} from '@market/shared-types';

/** グループ寄与列。 */
export type ScoreGroupColumn = {
  id: IndicatorCategoryId;
  /** UI 見出し用（例: トレンド）。 */
  label: string;
  /** CSV 列キー本体（例: trend → group_trend）。 */
  csvId: string;
};

/** 指標スコア列。 */
export type ScoreIndicatorColumn = {
  id: IndicatorCatalogId;
  /** UI 見出し用の短い系列ラベル。 */
  label: string;
};

/** カテゴリ名から末尾の「系」を除く（無ければそのまま）。 */
export function shortGroupLabel(nameJa: string): string {
  return nameJa.endsWith('系') ? nameJa.slice(0, -1) : nameJa;
}

/** スコアグループ列一覧（表示順）。 */
export function scoreGroupColumns(): ScoreGroupColumn[] {
  const byId = new Map(INDICATOR_CATEGORIES.map((c) => [c.id, c]));
  return scoreGroupCategoryIds().map((id) => {
    const category = byId.get(id)!;
    return {
      id,
      label: shortGroupLabel(category.nameJa),
      csvId: id,
    };
  });
}

/** 採点対象指標列一覧。 */
export function scoreIndicatorColumns(): ScoreIndicatorColumn[] {
  return scoringCatalogIds().map((id) => {
    const series0 = INDICATOR_CATALOG_BY_ID[id].series[0];
    return {
      id,
      label: series0?.label ?? id,
    };
  });
}

/** 総合スコア表示。null / 非有限は空欄。 */
export function formatScoreCell(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) {
    return '';
  }
  return formatDecisionScore(score);
}

/** グループ寄与セル。 */
export function formatGroupCell(
  breakdown: BacktestScoreBreakdown | null | undefined,
  categoryId: IndicatorCategoryId,
): string {
  const value = breakdown?.groups[categoryId];
  if (value == null || !Number.isFinite(value)) {
    return '';
  }
  return formatDecisionScore(value);
}

/** 指標スコアセル。 */
export function formatIndicatorCell(
  breakdown: BacktestScoreBreakdown | null | undefined,
  catalogId: IndicatorCatalogId,
): string {
  const value = breakdown?.indicators[catalogId];
  if (value == null || !Number.isFinite(value)) {
    return '';
  }
  return formatDecisionScore(value);
}

export type ScoreColumnPrefix = 'entry' | 'exit' | '';

/** UI 見出し。prefix 付きなら「エントリートレンド」など。 */
export function scoreColumnHeader(
  prefix: ScoreColumnPrefix,
  label: string,
): string {
  if (prefix === 'entry') {
    return `エントリー${label}`;
  }
  if (prefix === 'exit') {
    return `エグジット${label}`;
  }
  return label;
}

/** CSV 用グループ列キー。例: group_trend / entry_group_trend。 */
export function groupCsvKey(prefix: ScoreColumnPrefix, csvId: string): string {
  const base = `group_${csvId}`;
  if (prefix === '') {
    return base;
  }
  return `${prefix}_${base}`;
}

/** CSV 用指標列キー。例: rsi / entry_rsi。 */
export function indicatorCsvKey(
  prefix: ScoreColumnPrefix,
  catalogId: IndicatorCatalogId,
): string {
  if (prefix === '') {
    return catalogId;
  }
  return `${prefix}_${catalogId}`;
}

/** 日次 CSV / 表向け: グループ列ヘッダ一覧。 */
export function dailyGroupCsvHeaders(): string[] {
  return scoreGroupColumns().map((col) => groupCsvKey('', col.csvId));
}

/** 日次 CSV / 表向け: 指標列ヘッダ一覧。 */
export function dailyIndicatorCsvHeaders(): string[] {
  return scoreIndicatorColumns().map((col) => indicatorCsvKey('', col.id));
}

/** 取引 CSV 向け: entry/exit グループ列ヘッダ。 */
export function tradeGroupCsvHeaders(): string[] {
  return scoreGroupColumns().flatMap((col) => [
    groupCsvKey('entry', col.csvId),
    groupCsvKey('exit', col.csvId),
  ]);
}

/** 取引 CSV 向け: entry/exit 指標列ヘッダ。 */
export function tradeIndicatorCsvHeaders(): string[] {
  return scoreIndicatorColumns().flatMap((col) => [
    indicatorCsvKey('entry', col.id),
    indicatorCsvKey('exit', col.id),
  ]);
}