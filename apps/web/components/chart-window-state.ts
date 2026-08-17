/**
 * チャート分析画面のウィンドウ出し分け。
 *
 * Next.js の page.tsx は default export 以外を公開できないため、
 * トグルと高さ計算はここに置く。
 */

/** 指標設定の出し方。同時に両方は開かない。 */
export type IndicatorUiMode = 'closed' | 'modeless' | 'popout';

/** 同じ系統のウィンドウをトグルし、別系統へ切り替える。 */
export function nextIndicatorUiMode(
  current: IndicatorUiMode,
  requested: Exclude<IndicatorUiMode, 'closed'>,
): IndicatorUiMode {
  return current === requested ? 'closed' : requested;
}

/** 拡大ウィンドウでは画面高さと指標ペイン必要高さの大きい方を使う。 */
export function enlargedChartHeight(minHeight: number, viewportHeight: number): number {
  return Math.max(minHeight, viewportHeight);
}
