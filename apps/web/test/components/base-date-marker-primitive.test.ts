import { BaseDateMarkerPrimitive } from '../../components/base-date-marker-primitive';

describe('BaseDateMarkerPrimitive', () => {
  it('skips draw before attach, without date, and after detach', () => {
    const primitive = new BaseDateMarkerPrimitive();
    expect(primitive.getBaseDate()).toBeNull();
    const useBitmap = jest.fn();
    primitive.draw({ useBitmapCoordinateSpace: useBitmap });
    expect(useBitmap).not.toHaveBeenCalled();

    // attach 前に日付を変えても requestUpdate は呼べない（host 未設定）
    primitive.setBaseDate('2026-01-01');
    expect(primitive.getBaseDate()).toBe('2026-01-01');

    const requestUpdate = jest.fn();
    primitive.attached({
      chart: { timeScale: () => ({ timeToCoordinate: () => 10 }) },
      requestUpdate,
    });
    primitive.setBaseDate(null);
    expect(requestUpdate).toHaveBeenCalledTimes(1);
    primitive.draw({ useBitmapCoordinateSpace: useBitmap });
    expect(useBitmap).not.toHaveBeenCalled();

    primitive.setBaseDate('2026-01-02');
    expect(requestUpdate).toHaveBeenCalledTimes(2);
    expect(primitive.getBaseDate()).toBe('2026-01-02');

    primitive.detached();
    primitive.draw({ useBitmapCoordinateSpace: useBitmap });
    expect(useBitmap).not.toHaveBeenCalled();
  });

  it('does not request update when the date is unchanged', () => {
    const primitive = new BaseDateMarkerPrimitive('2026-01-02');
    const requestUpdate = jest.fn();
    primitive.attached({
      chart: { timeScale: () => ({ timeToCoordinate: () => 5 }) },
      requestUpdate,
    });
    primitive.setBaseDate('2026-01-02');
    expect(requestUpdate).not.toHaveBeenCalled();
  });

  it('skips draw when the date is off the visible scale', () => {
    const primitive = new BaseDateMarkerPrimitive('2026-01-02');
    const useBitmap = jest.fn();
    primitive.attached({
      chart: { timeScale: () => ({ timeToCoordinate: () => null }) },
      requestUpdate: jest.fn(),
    });
    primitive.draw({ useBitmapCoordinateSpace: useBitmap });
    expect(useBitmap).not.toHaveBeenCalled();
  });

  it('draws a vertical line and label for the base date', () => {
    const primitive = new BaseDateMarkerPrimitive('2026-01-03');
    const beginPath = jest.fn();
    const moveTo = jest.fn();
    const lineTo = jest.fn();
    const stroke = jest.fn();
    const strokeText = jest.fn();
    const fillText = jest.fn();
    const context = {
      beginPath,
      moveTo,
      lineTo,
      stroke,
      strokeText,
      fillText,
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
    } as unknown as CanvasRenderingContext2D;

    primitive.attached({
      chart: { timeScale: () => ({ timeToCoordinate: () => 20 }) },
      requestUpdate: jest.fn(),
    });
    primitive.draw({
      useBitmapCoordinateSpace: (fn) => {
        fn({
          context,
          horizontalPixelRatio: 2,
          verticalPixelRatio: 2,
          bitmapSize: { width: 200, height: 100 },
        });
      },
    });

    expect(beginPath).toHaveBeenCalled();
    expect(moveTo).toHaveBeenCalledWith(40, 0);
    expect(lineTo).toHaveBeenCalledWith(40, 100);
    expect(stroke).toHaveBeenCalled();
    expect(strokeText).toHaveBeenCalledWith('2026-01-03', 48, 8);
    expect(fillText).toHaveBeenCalledWith('2026-01-03', 48, 8);

    const views = primitive.paneViews();
    expect(views[0]?.zOrder()).toBe('top');
    primitive.updateAllViews();
    views[0]?.renderer().draw({
      useBitmapCoordinateSpace: (fn) => {
        fn({
          context,
          horizontalPixelRatio: 1,
          verticalPixelRatio: 1,
          bitmapSize: { width: 100, height: 50 },
        });
      },
    });
  });
});
