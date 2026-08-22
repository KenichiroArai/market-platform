/**
 * 基準日入力をスコア点列のバー日付へ揃える。
 *
 * 休日や週足ではカレンダー日付がバー日付と一致しないことがあるため、
 * 同じ日付、なければ直前（それも無ければ直後）の点の日付にスナップする。
 */

/** date プロパティだけあればよい最小形。 */
export type DatedPoint = { date: string };

/**
 * 入力日を points 内の日付へスナップする。
 * points が空、または入力が空なら null。
 */
export function snapBaseDate(
  points: DatedPoint[],
  inputDate: string,
): string | null {
  if (!inputDate || points.length === 0) {
    return null;
  }

  const exact = points.find((point) => point.date === inputDate);
  if (exact) {
    return exact.date;
  }

  let previous: string | null = null;
  for (const point of points) {
    if (point.date <= inputDate) {
      previous = point.date;
    } else {
      break;
    }
  }
  if (previous !== null) {
    return previous;
  }

  // points は空でない（冒頭でガード済み）
  return points[0]!.date;
}
