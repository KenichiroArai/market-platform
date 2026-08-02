import { act, render, screen } from '@testing-library/react';
import type { DailyPriceDto, IndicatorSeriesPoint } from '@market/shared-types';
import {
  AnalysisChart,
  toCandlestickData,
  toLineData,
  toMacdHistogramData,
  toVolumeData,
} from './analysis-chart';
import {
  createChart,
  __mocks as lwcMocks,
} from '../test-mocks/lightweight-charts';

const price: DailyPriceDto = {
  id: 'price_1',
  symbolId: 'sym_1',
  date: '2026-01-02',
  open: 100,
  high: 105,
  low: 99,
  close: 103,
  volume: 1000,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const downPrice: DailyPriceDto = {
  ...price,
  id: 'price_2',
  date: '2026-01-03',
  open: 103,
  high: 104,
  low: 98,
  close: 99,
  volume: 800,
};

const points: IndicatorSeriesPoint[] = [
  { date: '2026-01-02', sma: null, ema: 100, rsi: 55, macd: 1, macdSignal: 0.5, macdHistogram: 0.5 },
  { date: '2026-01-03', sma: 101, ema: 100.5, rsi: 48, macd: -0.2, macdSignal: 0.1, macdHistogram: -0.3 },
];

describe('analysis-chart helpers', () => {
  it('maps candlestick and volume data', () => {
    expect(toCandlestickData([price])[0]).toEqual({
      time: '2026-01-02',
      open: 100,
      high: 105,
      low: 99,
      close: 103,
    });
    expect(toVolumeData([price, downPrice])).toEqual([
      { time: '2026-01-02', value: 1000, color: 'rgba(38, 166, 154, 0.5)' },
      { time: '2026-01-03', value: 800, color: 'rgba(239, 83, 80, 0.5)' },
    ]);
  });

  it('skips null indicator values and colors MACD histogram by sign', () => {
    expect(toLineData(points, 'sma')).toEqual([{ time: '2026-01-03', value: 101 }]);
    expect(toLineData(points, 'ema')).toHaveLength(2);
    expect(toMacdHistogramData(points)).toEqual([
      { time: '2026-01-02', value: 0.5, color: 'rgba(38, 166, 154, 0.55)' },
      { time: '2026-01-03', value: -0.3, color: 'rgba(239, 83, 80, 0.55)' },
    ]);
  });
});

describe('AnalysisChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createChart as jest.Mock).mockImplementation(() => ({
      addSeries: jest.fn(() => ({ setData: lwcMocks.mockSetData })),
      panes: jest.fn(() => [
        { setHeight: lwcMocks.mockSetHeight },
        { setHeight: lwcMocks.mockSetHeight },
        { setHeight: lwcMocks.mockSetHeight },
      ]),
      timeScale: jest.fn(() => ({ fitContent: lwcMocks.mockFitContent })),
      applyOptions: lwcMocks.mockApplyOptions,
      remove: lwcMocks.mockRemove,
    }));
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 800,
    });
  });

  it('shows loading message', () => {
    render(<AnalysisChart prices={[]} indicatorPoints={[]} loading />);
    expect(screen.getByText('チャートを読み込み中…')).toBeInTheDocument();
    expect(createChart).not.toHaveBeenCalled();
  });

  it('shows empty message when there are no prices', () => {
    render(<AnalysisChart prices={[]} indicatorPoints={[]} />);
    expect(screen.getByText('この期間の価格データがありません')).toBeInTheDocument();
    expect(createChart).not.toHaveBeenCalled();
  });

  it('creates chart with all overlays by default', () => {
    const chartApi = {
      addSeries: jest.fn(() => ({ setData: lwcMocks.mockSetData })),
      panes: jest.fn(() => [
        { setHeight: lwcMocks.mockSetHeight },
        { setHeight: lwcMocks.mockSetHeight },
        { setHeight: lwcMocks.mockSetHeight },
      ]),
      timeScale: jest.fn(() => ({ fitContent: lwcMocks.mockFitContent })),
      applyOptions: lwcMocks.mockApplyOptions,
      remove: lwcMocks.mockRemove,
    };
    (createChart as jest.Mock).mockReturnValue(chartApi);

    render(<AnalysisChart prices={[price, downPrice]} indicatorPoints={points} />);
    expect(screen.getByTestId('analysis-chart')).toBeInTheDocument();
    expect(createChart).toHaveBeenCalled();
    expect(chartApi.addSeries).toHaveBeenCalledTimes(8);
    expect(lwcMocks.mockFitContent).toHaveBeenCalled();
    expect(lwcMocks.mockSetHeight).toHaveBeenCalled();
  });

  it('omits indicator series when overlays are off', () => {
    const chartApi = {
      addSeries: jest.fn(() => ({ setData: lwcMocks.mockSetData })),
      panes: jest.fn(() => [{ setHeight: lwcMocks.mockSetHeight }]),
      timeScale: jest.fn(() => ({ fitContent: lwcMocks.mockFitContent })),
      applyOptions: lwcMocks.mockApplyOptions,
      remove: lwcMocks.mockRemove,
    };
    (createChart as jest.Mock).mockReturnValue(chartApi);

    render(
      <AnalysisChart
        prices={[price]}
        indicatorPoints={points}
        overlays={{ sma: false, ema: false, rsi: false, macd: false }}
      />,
    );
    expect(chartApi.addSeries).toHaveBeenCalledTimes(2);
    expect(lwcMocks.mockSetHeight).not.toHaveBeenCalled();
  });

  it('removes chart on unmount and handles resize', () => {
    const { unmount } = render(
      <AnalysisChart prices={[price]} indicatorPoints={points} height={400} />,
    );
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(lwcMocks.mockApplyOptions).toHaveBeenCalledWith({ width: 800 });
    unmount();
    expect(lwcMocks.mockRemove).toHaveBeenCalled();
  });
});
