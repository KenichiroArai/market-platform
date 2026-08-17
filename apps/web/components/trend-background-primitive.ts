/**
 * トレンドスコアの縦帯背景（lightweight-charts v5 primitive）。
 *
 * ズーム/パンに追従するため timeToCoordinate で x を取り、価格ペイン全高を塗る。
 */
import type { Time } from 'lightweight-charts';
import type { TrendScorePoint } from '@market/shared-types';
import { trendScoreToRgba } from '../lib/trend-score-color';

type TimeScaleApi = {
  timeToCoordinate: (time: Time) => number | null;
};

type ChartApi = {
  timeScale: () => TimeScaleApi;
};

/** fancy-canvas 相当の描画ターゲット。直接依存せず型だけ合わせる。 */
export type BitmapDrawTarget = {
  useBitmapCoordinateSpace: (
    fn: (scope: {
      context: CanvasRenderingContext2D;
      horizontalPixelRatio: number;
      verticalPixelRatio: number;
      bitmapSize: { width: number; height: number };
    }) => void,
  ) => void;
};

const DEFAULT_BAR_WIDTH = 6;

/**
 * ローソクシリーズへ attach する背景 primitive。
 * zOrder は bottom でローソクの下に置く。
 */
export class TrendBackgroundPrimitive {
  private readonly points: { time: string; score: number | null }[];
  private chart: ChartApi | null = null;

  constructor(points: TrendScorePoint[]) {
    this.points = points.map((point) => ({ time: point.date, score: point.score }));
  }

  attached(param: { chart: ChartApi }): void {
    this.chart = param.chart;
  }

  detached(): void {
    this.chart = null;
  }

  updateAllViews(): void {
    // lightweight-charts が再描画前に呼ぶ。座標は draw 時に取る。
  }

  paneViews(): { zOrder: () => 'bottom'; renderer: () => { draw: (target: BitmapDrawTarget) => void } }[] {
    return [
      {
        zOrder: () => 'bottom',
        renderer: () => ({
          draw: (target: BitmapDrawTarget) => {
            this.draw(target);
          },
        }),
      },
    ];
  }

  /** テストからも呼べる描画本体。未 attach なら何もしない。 */
  draw(target: BitmapDrawTarget): void {
    if (this.chart === null) {
      return;
    }
    const timeScale = this.chart.timeScale();
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hRatio = scope.horizontalPixelRatio;
      const height = scope.bitmapSize.height;
      const xs: { x: number; score: number | null }[] = [];
      for (const point of this.points) {
        const x = timeScale.timeToCoordinate(point.time as Time);
        if (x === null) {
          continue;
        }
        xs.push({ x, score: point.score });
      }
      for (let i = 0; i < xs.length; i += 1) {
        const current = xs[i]!;
        if (current.score === null) {
          continue;
        }
        const next = xs[i + 1];
        const width = next === undefined ? DEFAULT_BAR_WIDTH : Math.max(1, next.x - current.x);
        ctx.fillStyle = trendScoreToRgba(current.score);
        ctx.fillRect(current.x * hRatio, 0, width * hRatio, height);
      }
    });
  }
}
