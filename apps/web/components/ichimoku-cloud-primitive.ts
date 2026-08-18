/**
 * 一目の雲（先行A/B の間）を価格ペインに塗る primitive。
 *
 * HTML オーバーレイだと期間を狭めたときに価格比がチャート外へはみ出す。
 * timeToCoordinate / priceToCoordinate でペイン canvas 内に描く。
 */
import type { Time } from 'lightweight-charts';
import type { IndicatorSeriesPoint } from '@market/shared-types';
import type { BitmapDrawTarget } from './trend-background-primitive';

type TimeScaleApi = {
  timeToCoordinate: (time: Time) => number | null;
};

type ChartApi = {
  timeScale: () => TimeScaleApi;
};

type SeriesApi = {
  priceToCoordinate: (price: number) => number | null;
};

const DEFAULT_BAR_WIDTH = 6;
const BULLISH_FILL = 'rgba(105, 240, 174, 0.12)';
const BEARISH_FILL = 'rgba(255, 82, 82, 0.12)';

type CloudPoint = { time: string; a: number; b: number };

/**
 * ローソクシリーズへ attach する雲 primitive。
 * zOrder は bottom でローソクの下に置く。
 */
export class IchimokuCloudPrimitive {
  private readonly points: CloudPoint[];
  private host: { chart: ChartApi; series: SeriesApi } | null = null;

  constructor(points: IndicatorSeriesPoint[]) {
    this.points = [];
    for (const point of points) {
      const a = point.values.ichimokuSenkouA;
      const b = point.values.ichimokuSenkouB;
      if (typeof a === 'number' && typeof b === 'number') {
        this.points.push({ time: point.date, a, b });
      }
    }
  }

  attached(param: { chart: ChartApi; series: SeriesApi }): void {
    this.host = { chart: param.chart, series: param.series };
  }

  detached(): void {
    this.host = null;
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
    if (this.host === null) {
      return;
    }
    const timeScale = this.host.chart.timeScale();
    const series = this.host.series;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hRatio = scope.horizontalPixelRatio;
      const vRatio = scope.verticalPixelRatio;
      const xs: { x: number; yA: number; yB: number; bullish: boolean }[] = [];
      for (const point of this.points) {
        const x = timeScale.timeToCoordinate(point.time as Time);
        const yA = series.priceToCoordinate(point.a);
        const yB = series.priceToCoordinate(point.b);
        if (x === null || yA === null || yB === null) {
          continue;
        }
        xs.push({ x, yA, yB, bullish: point.a >= point.b });
      }
      for (let i = 0; i < xs.length; i += 1) {
        const current = xs[i]!;
        const next = xs[i + 1];
        const width = next === undefined ? DEFAULT_BAR_WIDTH : Math.max(1, next.x - current.x);
        const y = Math.min(current.yA, current.yB);
        const height = Math.abs(current.yA - current.yB);
        ctx.fillStyle = current.bullish ? BULLISH_FILL : BEARISH_FILL;
        ctx.fillRect(current.x * hRatio, y * vRatio, width * hRatio, height * vRatio);
      }
    });
  }
}
