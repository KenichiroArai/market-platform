/**
 * トレンドスコアをチャート背景色へ写す（ADR 007）。
 *
 * 総合スコア表のストップを線形補間する。0 は透明。
 */

export type RgbaTuple = [number, number, number, number];

export const TREND_SCORE_COLOR_STOPS: { score: number; rgba: RgbaTuple }[] = [
  { score: 95, rgba: [38, 166, 154, 0.4] },
  { score: 60, rgba: [38, 166, 154, 0.28] },
  { score: 15, rgba: [38, 166, 154, 0.12] },
  { score: 0, rgba: [18, 38, 58, 0] },
  { score: -20, rgba: [239, 83, 80, 0.14] },
  { score: -65, rgba: [239, 83, 80, 0.28] },
  { score: -95, rgba: [239, 83, 80, 0.42] },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgba(a: RgbaTuple, b: RgbaTuple, t: number): RgbaTuple {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
}

/** RGBA 配列を CSS 文字列にする。 */
export function rgbaString(rgba: RgbaTuple): string {
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3]})`;
}

/**
 * 総合スコアを背景色にする。
 * ストップ外は端の色。ストップ間は線形補間。
 */
export function trendScoreToRgba(score: number): string {
  const stops = TREND_SCORE_COLOR_STOPS;
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (score >= first.score) {
    return rgbaString(first.rgba);
  }
  if (score <= last.score) {
    return rgbaString(last.rgba);
  }
  for (let i = 0; i < stops.length - 1; i += 1) {
    const high = stops[i]!;
    const low = stops[i + 1]!;
    if (score <= high.score && score >= low.score) {
      const t = (high.score - score) / (high.score - low.score);
      return rgbaString(lerpRgba(high.rgba, low.rgba, t));
    }
  }
  return rgbaString(last.rgba);
}
