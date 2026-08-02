/**
 * チャート分析向けの共有型・週足集約。
 *
 * DB は日足のみ保持するため、週足は API / クライアントで日足から組み立てる。
 * 集約ルールの正本は ADR 005。
 */

/** チャート足種。1d=日足、1w=週足（日足から集約）。 */
export type ChartInterval = '1d' | '1w';

/**
 * 週足集約に必要な最小 OHLC 形。
 * DailyPriceDto / AnalysisOhlcBar のどちらからも渡せるよう、id 等は持たない。
 */
export interface OhlcBarLike {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** ChartInterval として妥当かを判定する。 */
export function isChartInterval(value: unknown): value is ChartInterval {
  return value === '1d' || value === '1w';
}

/**
 * YYYY-MM-DD を UTC の Date に変換する（時刻は 00:00:00Z）。
 * 不正な文字列は null。
 */
function parseUtcDateOnly(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const parts = date.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

/**
 * UTC 月曜始まりの週キー（その週の月曜日の YYYY-MM-DD）を返す。
 * getUTCDay(): 0=日 … 6=土 → 月曜までの日数を引く。
 */
function utcMondayWeekKey(date: string): string | null {
  const parsed = parseUtcDateOnly(date);
  if (!parsed) {
    return null;
  }
  const day = parsed.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  parsed.setUTCDate(parsed.getUTCDate() - daysFromMonday);
  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const d = String(parsed.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 日足バー列を UTC 月曜始まりの週足に集約する。
 *
 * - 入力は日付昇順を想定（未ソートでも週キーでグループ化する）
 * - 各週: open=先頭 / high=max / low=min / close=末尾 / volume=sum
 * - 日付キーは週の最終取引日（入力順の最後）
 * - 不正な日付のバーはスキップする
 */
export function aggregateDailyBarsToWeekly<T extends OhlcBarLike>(bars: T[]): T[] {
  if (bars.length === 0) {
    return [];
  }

  // 週キー → その週に属するバー（出現順を維持）
  const groups = new Map<string, T[]>();
  for (const bar of bars) {
    const weekKey = utcMondayWeekKey(bar.date);
    if (!weekKey) {
      continue;
    }
    const group = groups.get(weekKey);
    if (group) {
      group.push(bar);
    } else {
      groups.set(weekKey, [bar]);
    }
  }

  const weekKeys = [...groups.keys()].sort();
  const weekly: T[] = [];

  for (const weekKey of weekKeys) {
    // weekKeys は groups のキー由来のため必ず存在する
    const group = groups.get(weekKey)!;
    // グループ内を日付昇順に揃える（入力が乱れていても安定させる）
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    let high = first.high;
    let low = first.low;
    let volume = 0;
    for (const bar of sorted) {
      high = Math.max(high, bar.high);
      low = Math.min(low, bar.low);
      volume += bar.volume;
    }
    weekly.push({
      ...last,
      date: last.date,
      open: first.open,
      high,
      low,
      close: last.close,
      volume,
    });
  }

  return weekly;
}
