/**
 * チャート分析画面の期間初期値。
 *
 * From は今日から 1 年前の同じ月の 1 日。
 * To は今日から 1 か月先の月末。一目の先行スパンなど、
 * 表示期間より先の描画を収めるため。
 */

/** ローカル日付を YYYY-MM-DD にする。UTC 変換は日跨ぎでずれるため使わない。 */
function formatDateOnly(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * チャート分析の初期 From（YYYY-MM-DD）。
 * 基準日の 1 年前の同じ月の 1 日。
 */
export function defaultChartFromDate(now: Date = new Date()): string {
  const year = now.getFullYear() - 1;
  const month = now.getMonth();
  return formatDateOnly(new Date(year, month, 1));
}

/**
 * チャート分析の初期 To（YYYY-MM-DD）。
 * 基準日の翌月の最終日。12 月なら翌年 1 月末。
 */
export function defaultChartToDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth();
  // month+1 が翌月。その月末は (year, month+2, 0)
  return formatDateOnly(new Date(year, month + 2, 0));
}
