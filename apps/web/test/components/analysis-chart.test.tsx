import { act, render, screen } from '@testing-library/react';
import type { DailyPriceDto, IndicatorSeriesPoint } from '@market/shared-types';
import {
  AnalysisChart,
  chartTimeToDateString,
  computeAnalysisChartHeight,
  isOverlayEnabled,
  latestScoredPoint,
  resolveOwnerWindow,
  resolveMarkerDate,
  resolveScoredPoint,
  toCandlestickData,
  toLineData,
  toMacdHistogramData,
  toSignedHistogramData,
  toVolumeData,
  volumeProfileLayout,
} from '../../components/analysis-chart';
import {
  createChart,
  __mocks as lwcMocks,
} from '../mocks/lightweight-charts';
import type { Time } from 'lightweight-charts';

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
    addSeries: jest.fn(() => ({ setData: lwcMocks.mockSetData, createPriceLine, attachPrimitive: lwcMocks.mockAttachPrimitive })),
    panes: jest.fn(() => [
      { setHeight: lwcMocks.mockSetHeight },
      { setHeight: lwcMocks.mockSetHeight },
      { setHeight: lwcMocks.mockSetHeight },
    ]),
    timeScale: jest.fn(() => ({ fitContent: lwcMocks.mockFitContent })),
    applyOptions: lwcMocks.mockApplyOptions,
    remove: lwcMocks.mockRemove,
    subscribeClick: lwcMocks.mockSubscribeClick,
    unsubscribeClick: lwcMocks.mockUnsubscribeClick,
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
    expect(computeAnalysisChartHeight(new Set(['volume', 'rsi', 'macd']))).toBe(320 + 90 * 3);
    expect(isOverlayEnabled(new Set(['sma25']), 'sma25')).toBe(true);
    expect(isOverlayEnabled(new Set(['elliott']), 'elliott')).toBe(false);
    expect(resolveOwnerWindow({ ownerDocument: { defaultView: window } })).toBe(window);
    expect(resolveOwnerWindow({ ownerDocument: { defaultView: null } })).toBe(window);
    expect(latestScoredPoint([])).toBeNull();
    expect(
      latestScoredPoint([
        {
          date: '2026-01-02',
          score: null,
          groups: {
            trend: null,
            momentum: null,
            oscillator: null,
            volatility: null,
            volume: null,
            cycle: null,
          },
          indicators: {},
        },
      ]),
    ).toBeNull();
    expect(
      latestScoredPoint([
        {
          date: '2026-01-02',
          score: 12,
          groups: {
            trend: 12,
            momentum: null,
            oscillator: null,
            volatility: null,
            volume: null,
            cycle: null,
          },
          indicators: {},
        },
      ])?.score,
    ).toBe(12);
    const early = {
      date: '2026-01-02',
      score: 10,
      groups: {
        trend: 10,
        momentum: null,
        oscillator: null,
        volatility: null,
        volume: null,
        cycle: null,
      },
      indicators: {},
    };
    const late = {
      date: '2026-01-03',
      score: 20,
      groups: {
        trend: 20,
        momentum: null,
        oscillator: null,
        volatility: null,
        volume: null,
        cycle: null,
      },
      indicators: {},
    };
    expect(resolveScoredPoint([early, late], null)?.date).toBe('2026-01-03');
    expect(resolveScoredPoint([early, late], '2026-01-02')?.score).toBe(10);
    expect(resolveScoredPoint([early, late], '2099-01-01')?.date).toBe('2026-01-03');
    expect(resolveMarkerDate([early, late], null)).toBe('2026-01-03');
    expect(resolveMarkerDate([early, late], '2026-01-02')).toBe('2026-01-02');
    expect(resolveMarkerDate([], null)).toBeNull();
    expect(chartTimeToDateString('2026-01-02' as Time)).toBe('2026-01-02');
    expect(chartTimeToDateString(1_704_067_200 as Time)).toBe('2024-01-01');
    expect(chartTimeToDateString({ year: 2026, month: 1, day: 5 } as Time)).toBe('2026-01-05');
    expect(chartTimeToDateString({} as Time)).toBeNull();
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
        trendScorePoints={[
          {
            date: '2026-01-02',
            score: 60,
            groups: {
              trend: 24,
              momentum: 10,
              oscillator: 5,
              volatility: 5,
              volume: 8,
              cycle: 8,
            },
            indicators: { sma25: 80 },
          },
        ]}
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
    expect(screen.getAllByTestId('volume-profile-bar').length).toBeGreaterThan(0);
    expect(lwcMocks.mockFitContent).toHaveBeenCalled();
    expect(lwcMocks.mockSetHeight).toHaveBeenCalled();
    expect(lwcMocks.mockAttachPrimitive).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId('trend-score-label')).toHaveTextContent('上昇トレンド');
    expect(screen.getByTestId('trend-score-base-date')).toHaveTextContent('基準日 2026-01-02');
    expect(lwcMocks.mockSubscribeClick).toHaveBeenCalled();
  });

  it('uses baseDate for the score label and notifies onBarClick', () => {
    const onBarClick = jest.fn();
    const api = chartApi();
    (createChart as jest.Mock).mockReturnValue(api);
    let clickHandler: ((param: { time?: Time }) => void) | undefined;
    lwcMocks.mockSubscribeClick.mockImplementation((handler: (param: { time?: Time }) => void) => {
      clickHandler = handler;
    });

    render(
      <AnalysisChart
        prices={[price, downPrice]}
        indicatorPoints={points}
        baseDate="2026-01-02"
        onBarClick={onBarClick}
        trendScorePoints={[
          {
            date: '2026-01-02',
            score: 12,
            groups: {
              trend: 12,
              momentum: null,
              oscillator: null,
              volatility: null,
              volume: null,
              cycle: null,
            },
            indicators: {},
          },
          {
            date: '2026-01-03',
            score: 60,
            groups: {
              trend: 24,
              momentum: null,
              oscillator: null,
              volatility: null,
              volume: null,
              cycle: null,
            },
            indicators: {},
          },
        ]}
      />,
    );
    expect(screen.getByTestId('trend-score-label')).toHaveTextContent('基準日 2026-01-02');
    expect(screen.getByTestId('trend-score-label')).toHaveTextContent('12');
    act(() => {
      clickHandler?.({ time: '2026-01-03' as Time });
      clickHandler?.({});
      clickHandler?.({ time: {} as Time });
    });
    expect(onBarClick).toHaveBeenCalledWith('2026-01-03');
    expect(onBarClick).toHaveBeenCalledTimes(1);
  });

  it('shows scoreなし when base date has a null score', () => {
    render(
      <AnalysisChart
        prices={[price]}
        indicatorPoints={points}
        baseDate="2026-01-02"
        trendScorePoints={[
          {
            date: '2026-01-02',
            score: null,
            groups: {
              trend: null,
              momentum: null,
              oscillator: null,
              volatility: null,
              volume: null,
              cycle: null,
            },
            indicators: {},
          },
        ]}
      />,
    );
    expect(screen.getByTestId('trend-score-label')).toHaveTextContent('スコアなし');
  });

  it('skips price lines when createPriceLine is missing', () => {
    const api = {
      addSeries: jest.fn(() => ({ setData: lwcMocks.mockSetData })),
      panes: jest.fn(() => [{ setHeight: lwcMocks.mockSetHeight }]),
      timeScale: jest.fn(() => ({ fitContent: lwcMocks.mockFitContent })),
      applyOptions: lwcMocks.mockApplyOptions,
      remove: lwcMocks.mockRemove,
      subscribeClick: lwcMocks.mockSubscribeClick,
      unsubscribeClick: lwcMocks.mockUnsubscribeClick,
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
      subscribeClick: lwcMocks.mockSubscribeClick,
      unsubscribeClick: lwcMocks.mockUnsubscribeClick,
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
    expect(lwcMocks.mockAttachPrimitive).not.toHaveBeenCalled();
  });

  it('attaches ichimoku cloud primitive without trend score', () => {
    render(
      <AnalysisChart
        prices={[price]}
        indicatorPoints={points}
        enabledIds={new Set(['ichimoku'])}
      />,
    );
    expect(lwcMocks.mockAttachPrimitive).toHaveBeenCalledTimes(2);
  });

  it('attaches only the base-date marker when no overlays are enabled', () => {
    const api = {
      addSeries: jest.fn(() => ({
        setData: lwcMocks.mockSetData,
        attachPrimitive: lwcMocks.mockAttachPrimitive,
      })),
      panes: jest.fn(() => [{ setHeight: lwcMocks.mockSetHeight }]),
      timeScale: jest.fn(() => ({ fitContent: lwcMocks.mockFitContent })),
      applyOptions: lwcMocks.mockApplyOptions,
      remove: lwcMocks.mockRemove,
      subscribeClick: lwcMocks.mockSubscribeClick,
      unsubscribeClick: lwcMocks.mockUnsubscribeClick,
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
    expect(lwcMocks.mockAttachPrimitive).toHaveBeenCalledTimes(1);
  });

  it('updates the base-date marker when baseDate changes without remounting the chart', () => {
    const chartPrices = [price, downPrice];
    const trendScorePoints = [
      {
        date: '2026-01-02',
        score: 12,
        groups: {
          trend: 12,
          momentum: null,
          oscillator: null,
          volatility: null,
          volume: null,
          cycle: null,
        },
        indicators: {},
      },
      {
        date: '2026-01-03',
        score: 60,
        groups: {
          trend: 24,
          momentum: null,
          oscillator: null,
          volatility: null,
          volume: null,
          cycle: null,
        },
        indicators: {},
      },
    ];
    const { rerender } = render(
      <AnalysisChart
        prices={chartPrices}
        indicatorPoints={points}
        baseDate="2026-01-02"
        trendScorePoints={trendScorePoints}
      />,
    );
    expect(createChart).toHaveBeenCalledTimes(1);
    rerender(
      <AnalysisChart
        prices={chartPrices}
        indicatorPoints={points}
        baseDate="2026-01-03"
        trendScorePoints={trendScorePoints}
      />,
    );
    expect(createChart).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('trend-score-label')).toHaveTextContent('基準日 2026-01-03');
  });

  it('removes chart on unmount and handles resize', () => {
    const { unmount } = render(
      <AnalysisChart
        prices={[price]}
        indicatorPoints={points}
        enabledIds={new Set(['volume'])}
        height={400}
        trendScorePoints={[
          {
            date: '2026-01-02',
            score: 12,
            groups: {
              trend: 12,
              momentum: null,
              oscillator: null,
              volatility: null,
              volume: null,
              cycle: null,
            },
            indicators: {},
          },
        ]}
      />,
    );
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(lwcMocks.mockApplyOptions).toHaveBeenCalledWith({ width: 800 });
    unmount();
    expect(lwcMocks.mockUnsubscribeClick).toHaveBeenCalled();
    expect(lwcMocks.mockRemove).toHaveBeenCalled();
  });
});
