import { act, render, screen } from '@testing-library/react';
import type { DailyPriceDto, IndicatorSeriesPoint } from '@market/shared-types';
import {
  AnalysisChart,
  computeAnalysisChartHeight,
  ichimokuCloudSegments,
  isOverlayEnabled,
  toCandlestickData,
  toLineData,
  toMacdHistogramData,
  toSignedHistogramData,
  toVolumeData,
  volumeProfileLayout,
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
  {
    date: '2026-01-02',
    values: {
      sma25: null,
      ema50: 100,
      rsi: 55,
      macd: 1,
      macdSignal: 0.5,
      macdHistogram: 0.5,
      ichimokuSenkouA: 102,
      ichimokuSenkouB: 100,
    },
  },
  {
    date: '2026-01-03',
    values: {
      sma25: 101,
      ema50: 100.5,
      rsi: 48,
      macd: -0.2,
      macdSignal: 0.1,
      macdHistogram: -0.3,
      ichimokuSenkouA: 99,
      ichimokuSenkouB: 101,
    },
  },
];

function chartApi(createPriceLine = jest.fn()) {
  return {
    addSeries: jest.fn(() => ({ setData: lwcMocks.mockSetData, createPriceLine })),
    panes: jest.fn(() => [
      { setHeight: lwcMocks.mockSetHeight },
      { setHeight: lwcMocks.mockSetHeight },
      { setHeight: lwcMocks.mockSetHeight },
    ]),
    timeScale: jest.fn(() => ({ fitContent: lwcMocks.mockFitContent })),
    applyOptions: lwcMocks.mockApplyOptions,
    remove: lwcMocks.mockRemove,
  };
}

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

  it('skips null indicator values and colors histograms by sign', () => {
    expect(toLineData(points, 'sma25')).toEqual([{ time: '2026-01-03', value: 101 }]);
    expect(toLineData(points, 'ema50')).toHaveLength(2);
    expect(toMacdHistogramData(points)).toEqual([
      { time: '2026-01-02', value: 0.5, color: 'rgba(38, 166, 154, 0.55)' },
      { time: '2026-01-03', value: -0.3, color: 'rgba(239, 83, 80, 0.55)' },
    ]);
    expect(toSignedHistogramData(points, 'missing')).toEqual([]);
  });

  it('layouts volume profile and ichimoku cloud', () => {
    expect(volumeProfileLayout([], 0.5)).toEqual([]);
    expect(
      volumeProfileLayout([{ priceLow: 2, priceHigh: 2, volume: 4 }], 0.5)[0]?.widthPct,
    ).toBe(18);
    expect(
      volumeProfileLayout([{ priceLow: 1, priceHigh: 3, volume: 0 }], 0.5),
    ).toHaveLength(1);
    expect(
      volumeProfileLayout(
        [
          { priceLow: 1, priceHigh: 1, volume: 0 },
          { priceLow: 1, priceHigh: 1, volume: 0 },
        ],
        0.5,
      ),
    ).toHaveLength(2);
    const layout = volumeProfileLayout(
      [
        { priceLow: 1, priceHigh: 2, volume: 10 },
        { priceLow: 2, priceHigh: 3, volume: 5 },
      ],
      0.5,
    );
    expect(layout[0]?.widthPct).toBe(18);
    expect(ichimokuCloudSegments([], 1, 2, 0.5)).toEqual([]);
    expect(ichimokuCloudSegments(points, 1, 1, 0.5)).toEqual([]);
    const cloud = ichimokuCloudSegments(points, 90, 110, 0.5);
    expect(cloud).toHaveLength(2);
    expect(cloud[0]?.bullish).toBe(true);
    expect(cloud[1]?.bullish).toBe(false);
    expect(
      ichimokuCloudSegments([{ date: '2026-01-02', values: {} }], 90, 110, 0.5),
    ).toEqual([]);
    expect(computeAnalysisChartHeight(new Set(['volume', 'rsi', 'macd']))).toBe(320 + 90 * 3);
    expect(isOverlayEnabled(new Set(['sma25']), 'sma25')).toBe(true);
    expect(isOverlayEnabled(new Set(['elliott']), 'elliott')).toBe(false);
  });
});

describe('AnalysisChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createChart as jest.Mock).mockImplementation(() => chartApi());
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

  it('creates chart with overlays, oscillators, fibonacci and volume profile', () => {
    const api = chartApi();
    (createChart as jest.Mock).mockReturnValue(api);

    render(
      <AnalysisChart
        prices={[price, downPrice]}
        indicatorPoints={points}
        enabledIds={new Set(['sma25', 'volume', 'rsi', 'macd', 'psar', 'ichimoku', 'fibonacci', 'volumeProfile'])}
        drawings={{
          fibonacci: {
            high: 105,
            low: 98,
            highDate: '2026-01-02',
            lowDate: '2026-01-03',
            levels: [{ ratio: 0.5, price: 101.5 }],
          },
          volumeProfile: {
            bins: [
              { priceLow: 98, priceHigh: 101, volume: 10 },
              { priceLow: 101, priceHigh: 105, volume: 5 },
            ],
          },
        }}
      />,
    );
    expect(screen.getByTestId('analysis-chart')).toBeInTheDocument();
    expect(createChart).toHaveBeenCalled();
    expect(api.addSeries).toHaveBeenCalled();
    expect(screen.getAllByTestId('ichimoku-cloud-seg').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('volume-profile-bar').length).toBeGreaterThan(0);
    expect(lwcMocks.mockFitContent).toHaveBeenCalled();
    expect(lwcMocks.mockSetHeight).toHaveBeenCalled();
  });

  it('skips price lines when createPriceLine is missing', () => {
    const api = {
      addSeries: jest.fn(() => ({ setData: lwcMocks.mockSetData })),
      panes: jest.fn(() => [{ setHeight: lwcMocks.mockSetHeight }]),
      timeScale: jest.fn(() => ({ fitContent: lwcMocks.mockFitContent })),
      applyOptions: lwcMocks.mockApplyOptions,
      remove: lwcMocks.mockRemove,
    };
    (createChart as jest.Mock).mockReturnValue(api);
    render(
      <AnalysisChart
        prices={[price]}
        indicatorPoints={points}
        enabledIds={new Set(['fibonacci', 'volumeProfile'])}
        drawings={{
          fibonacci: {
            high: 105,
            low: 98,
            highDate: '2026-01-02',
            lowDate: '2026-01-03',
            levels: [{ ratio: 0.5, price: 101.5 }],
          },
        }}
      />,
    );
    expect(api.addSeries).toHaveBeenCalled();
  });

  it('omits indicator series when none are enabled', () => {
    const api = {
      addSeries: jest.fn(() => ({ setData: lwcMocks.mockSetData })),
      panes: jest.fn(() => [{ setHeight: lwcMocks.mockSetHeight }]),
      timeScale: jest.fn(() => ({ fitContent: lwcMocks.mockFitContent })),
      applyOptions: lwcMocks.mockApplyOptions,
      remove: lwcMocks.mockRemove,
    };
    (createChart as jest.Mock).mockReturnValue(api);

    render(
      <AnalysisChart
        prices={[price]}
        indicatorPoints={points}
        enabledIds={new Set()}
      />,
    );
    expect(api.addSeries).toHaveBeenCalledTimes(1);
    expect(lwcMocks.mockSetHeight).not.toHaveBeenCalled();
  });

  it('removes chart on unmount and handles resize', () => {
    const { unmount } = render(
      <AnalysisChart
        prices={[price]}
        indicatorPoints={points}
        enabledIds={new Set(['volume'])}
        height={400}
      />,
    );
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(lwcMocks.mockApplyOptions).toHaveBeenCalledWith({ width: 800 });
    unmount();
    expect(lwcMocks.mockRemove).toHaveBeenCalled();
  });
});
