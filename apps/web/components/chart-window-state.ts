/**
 * チャート分析画面のウィンドウ出し分け。
 *
 * Next.js の page.tsx は default export 以外を公開できないため、
 * トグルと高さ計算はここに置く。
 *
 * 希望表示（preferred）は画面で1つ。各窓の ui は独立に記憶する。
 * 親のラジオ変更だけでは開いているウィンドウを切り替えない。
 * ボタン再押下で preferred に合わせ、ウィンドウ内切替はその窓だけ即時変更する。
 */

/** 表示の希望モード（親画面ラジオ・ウィンドウ内切替）。 */
export type WindowDisplayMode = 'modeless' | 'popout';

/** 実際の表示状態。閉じているか、どちらか一方で開いている。 */
export type WindowUiState = 'closed' | WindowDisplayMode;

/** @deprecated WindowUiState と同義。既存呼び出し互換。 */
export type IndicatorUiMode = WindowUiState;

/**
 * オープンボタン押下時の次状態。
 * - closed → preferred で開く
 * - 開いていて current === preferred → 閉じる
 * - 開いていて current !== preferred → preferred へ切替（再押下で切替）
 */
export function nextOpenToggle(
  current: WindowUiState,
  preferred: WindowDisplayMode,
): WindowUiState {
  return current === preferred ? 'closed' : preferred;
}

/**
 * 同じ系統のウィンドウをトグルし、別系統へ切り替える。
 * nextOpenToggle と同義（requested = preferred）。
 */
export function nextIndicatorUiMode(
  current: IndicatorUiMode,
  requested: WindowDisplayMode,
): IndicatorUiMode {
  return nextOpenToggle(current, requested);
}

/**
 * 拡大ウィンドウのチャート高さ（互換用）。
 * Ph5 以降は本画面と同じ computeAnalysisChartHeight を使うため、minHeight を返す。
 */
export function enlargedChartHeight(minHeight: number, _viewportHeight?: number, _chromePx?: number): number {
  return minHeight;
}
