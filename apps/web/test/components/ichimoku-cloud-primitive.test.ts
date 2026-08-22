import type { IndicatorSeriesPoint } from '@market/shared-types';
import { IchimokuCloudPrimitive } from '../../components/ichimoku-cloud-primitive';

const points: IndicatorSeriesPoint[] = [
  {
    date: '2026-01-02',
    values: { ichimokuSenkouA: 102, ichimokuSenkouB: 100 },
  },
  {
    date: '2026-01-03',
    values: { ichimokuSenkouA: 1 },
  },
  {
    date: '2026-01-03b',
    values: { ichimokuSenkouB: 1 },
  },
  {
    date: '2026-01-04',
    values: { ichimokuSenkouA: 99, ichimokuSenkouB: 101 },
  },
  {
    date: '2026-01-05',
    values: { ichimokuSenkouA: 103, ichimokuSenkouB: 101 },
  },
  {
    date: '2026-01-06',
    values: { ichimokuSenkouA: 50, ichimokuSenkouB: 51 },
  },
  {
    date: '2026-01-07',
    values: { ichimokuSenkouA: 70, ichimokuSenkouB: 71 },
  },
];

describe('IchimokuCloudPrimitive', () => {
  it('skips draw before attach and after detach', () => {
    const primitive = new IchimokuCloudPrimitive(points);
    const useBitmap = jest.fn();
    primitive.draw({ useBitmapCoordinateSpace: useBitmap });
    expect(useBitmap).not.toHaveBeenCalled();
    primitive.updateAllViews();
    primitive.attached({
      chart: { timeScale: () => ({ timeToCoordinate: () => 10 }) },
      series: { priceToCoordinate: () => 20 },
    });
    primitive.detached();
    primitive.draw({ useBitmapCoordinateSpace: useBitmap });
    expect(useBitmap).not.toHaveBeenCalled();
  });

  it('fills visible bars and skips null coordinates', () => {
    const primitive = new IchimokuCloudPrimitive(points);
    const fillRect = jest.fn();
    const timeToCoordinate = jest.fn((time: string) => {
      if (time === '2026-01-02') {
        return 0;
      }
      if (time === '2026-01-05') {
        return 10;
      }
      if (time === '2026-01-06') {
        return 20;
      }
      if (time === '2026-01-07') {
        return 30;
      }
      return null;
    });
    const priceToCoordinate = jest.fn((price: number) => {
      if (price === 102) {
        return 8;
      }
      if (price === 100) {
        return 12;
      }
      if (price === 103) {
        return 6;
      }
      if (price === 101) {
        return 11;
      }
      if (price === 50) {
        return 9;
      }
      return null;
    });
    primitive.attached({
      chart: { timeScale: () => ({ timeToCoordinate }) },
      series: { priceToCoordinate },
    });
    primitive.draw({
      useBitmapCoordinateSpace: (fn) => {
        fn({
          context: { fillRect, fillStyle: '' } as unknown as CanvasRenderingContext2D,
          horizontalPixelRatio: 2,
          verticalPixelRatio: 1,
          bitmapSize: { width: 200, height: 100 },
        });
      },
    });
    expect(fillRect).toHaveBeenCalledTimes(2);
    expect(fillRect).toHaveBeenNthCalledWith(1, 0, 8, 20, 4);
    expect(fillRect).toHaveBeenNthCalledWith(2, 20, 6, 12, 5);

    const views = primitive.paneViews();
    expect(views[0]?.zOrder()).toBe('bottom');
    const renderer = views[0]?.renderer();
    renderer?.draw({
      useBitmapCoordinateSpace: (fn) => {
        fn({
          context: { fillRect, fillStyle: '' } as unknown as CanvasRenderingContext2D,
          horizontalPixelRatio: 1,
          verticalPixelRatio: 1,
          bitmapSize: { width: 100, height: 50 },
        });
      },
    });
  });

  it('uses default width for the last visible bar and bearish color', () => {
    const primitive = new IchimokuCloudPrimitive([
      { date: '2026-01-02', values: { ichimokuSenkouA: 90, ichimokuSenkouB: 110 } },
    ]);
    const fillStyles: string[] = [];
    const context = {
      fillStyle: '',
      fillRect: jest.fn(),
    };
    primitive.attached({
      chart: { timeScale: () => ({ timeToCoordinate: () => 4 }) },
      series: {
        priceToCoordinate: (price: number) => (price === 90 ? 30 : 10),
      },
    });
    primitive.draw({
      useBitmapCoordinateSpace: (fn) => {
        fn({
          context: {
            get fillStyle() {
              return context.fillStyle;
            },
            set fillStyle(value: string) {
              context.fillStyle = value;
              fillStyles.push(value);
            },
            fillRect: context.fillRect,
          } as unknown as CanvasRenderingContext2D,
          horizontalPixelRatio: 1,
          verticalPixelRatio: 2,
          bitmapSize: { width: 80, height: 40 },
        });
      },
    });
    expect(context.fillRect).toHaveBeenCalledWith(4, 20, 6, 40);
    expect(fillStyles).toContain('rgba(255, 82, 82, 0.12)');
  });
});
