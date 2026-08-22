import type { TrendScorePoint } from '@market/shared-types';
import { TrendBackgroundPrimitive } from '../../components/trend-background-primitive';

function emptyGroups(): TrendScorePoint['groups'] {
  return {
    trend: null,
    momentum: null,
    oscillator: null,
    volatility: null,
    volume: null,
    cycle: null,
  };
}

describe('TrendBackgroundPrimitive', () => {
  const points: TrendScorePoint[] = [
    { date: '2026-01-02', score: 60, groups: emptyGroups(), indicators: {} },
    { date: '2026-01-03', score: null, groups: emptyGroups(), indicators: {} },
    { date: '2026-01-04', score: -20, groups: emptyGroups(), indicators: {} },
  ];

  it('skips draw before attach and after detach', () => {
    const primitive = new TrendBackgroundPrimitive(points);
    const useBitmap = jest.fn();
    primitive.draw({ useBitmapCoordinateSpace: useBitmap });
    expect(useBitmap).not.toHaveBeenCalled();
    primitive.updateAllViews();
    primitive.attached({
      chart: { timeScale: () => ({ timeToCoordinate: () => 10 }) },
    });
    primitive.detached();
    primitive.draw({ useBitmapCoordinateSpace: useBitmap });
    expect(useBitmap).not.toHaveBeenCalled();
  });

  it('fills visible bars and skips null coordinates and null scores', () => {
    const primitive = new TrendBackgroundPrimitive(points);
    const fillRect = jest.fn();
    const timeToCoordinate = jest.fn((time: string) => {
      if (time === '2026-01-02') {
        return 0;
      }
      if (time === '2026-01-03') {
        return 10;
      }
      return null;
    });
    primitive.attached({
      chart: { timeScale: () => ({ timeToCoordinate }) },
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
    expect(fillRect).toHaveBeenCalledTimes(1);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 20, 100);

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

  it('uses default width for the last visible bar', () => {
    const primitive = new TrendBackgroundPrimitive([
      { date: '2026-01-02', score: 15, groups: emptyGroups(), indicators: {} },
    ]);
    const fillRect = jest.fn();
    primitive.attached({
      chart: { timeScale: () => ({ timeToCoordinate: () => 4 }) },
    });
    primitive.draw({
      useBitmapCoordinateSpace: (fn) => {
        fn({
          context: { fillRect, fillStyle: '' } as unknown as CanvasRenderingContext2D,
          horizontalPixelRatio: 1,
          verticalPixelRatio: 1,
          bitmapSize: { width: 80, height: 40 },
        });
      },
    });
    expect(fillRect).toHaveBeenCalledWith(4, 0, 6, 40);
  });
});
