/**
 * 基準日を示す縦線マーカー（lightweight-charts v5 primitive / Ph6）。
 *
 * 価格ペイン全高に黒の縦線を引き、上部に黒文字で日付を出す。
 * 基準日クリックで位置が変わるため、setBaseDate + requestUpdate で再描画する。
 */
import type { Time } from 'lightweight-charts';
import type { BitmapDrawTarget } from './trend-background-primitive';

type TimeScaleApi = {
  timeToCoordinate: (time: Time) => number | null;
};

type ChartApi = {
  timeScale: () => TimeScaleApi;
};

type AttachedParam = {
  chart: ChartApi;
  requestUpdate: () => void;
};

const LINE_COLOR = '#111111';
const LABEL_COLOR = '#111111';
const LABEL_HALO = 'rgba(255, 255, 255, 0.92)';

/**
 * ローソクシリーズへ attach する基準日マーカー。
 * zOrder は top でローソクの上に置く。
 */
export class BaseDateMarkerPrimitive {
  private baseDate: string | null;
  private host: AttachedParam | null = null;

  constructor(baseDate: string | null = null) {
    this.baseDate = baseDate;
  }

  /** 基準日を差し替え、描画済みなら再描画を依頼する。 */
  setBaseDate(date: string | null): void {
    if (this.baseDate === date) {
      return;
    }
    this.baseDate = date;
    this.host?.requestUpdate();
  }

  /** 現在の基準日（テスト用）。 */
  getBaseDate(): string | null {
    return this.baseDate;
  }

  attached(param: AttachedParam): void {
    this.host = param;
  }

  detached(): void {
    this.host = null;
  }

  updateAllViews(): void {
    // lightweight-charts が再描画前に呼ぶ。座標は draw 時に取る。
  }

  paneViews(): { zOrder: () => 'top'; renderer: () => { draw: (target: BitmapDrawTarget) => void } }[] {
    return [
      {
        zOrder: () => 'top',
        renderer: () => ({
          draw: (target: BitmapDrawTarget) => {
            this.draw(target);
          },
        }),
      },
    ];
  }

  /** テストからも呼べる描画本体。未 attach または基準日なしなら何もしない。 */
  draw(target: BitmapDrawTarget): void {
    const date = this.baseDate;
    if (this.host === null || date === null) {
      return;
    }
    const timeScale = this.host.chart.timeScale();
    const x = timeScale.timeToCoordinate(date as Time);
    if (x === null) {
      return;
    }
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hRatio = scope.horizontalPixelRatio;
      const vRatio = scope.verticalPixelRatio;
      const height = scope.bitmapSize.height;
      const px = x * hRatio;

      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = Math.max(1, Math.round(1.5 * hRatio));
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();

      const fontSize = Math.max(11, Math.round(12 * vRatio));
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const textX = px + 4 * hRatio;
      const textY = 4 * vRatio;

      // 暗いチャート上でも黒文字が読めるよう、白のハローを先に敷く
      ctx.lineWidth = Math.max(2, Math.round(3 * vRatio));
      ctx.strokeStyle = LABEL_HALO;
      ctx.strokeText(date, textX, textY);
      ctx.fillStyle = LABEL_COLOR;
      ctx.fillText(date, textX, textY);
    });
  }
}
