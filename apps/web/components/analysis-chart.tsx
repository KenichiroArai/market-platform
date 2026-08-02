/**
 * チャート分析用のローソク足コンポーネント（ADR 005）。
 *
 * TradingView lightweight-charts v5 で:
 * - Pane 0: ローソク + SMA / EMA
 * - Pane 1: Volume
 * - Pane 2: RSI
 * - Pane 3: MACD
 * ズーム・パンは timeScale の標準操作に任せる。
 */
'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import type { DailyPriceDto, IndicatorSeriesPoint } from '@market/shared-types';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';

/** 表示する指標のトグル。 */
export type AnalysisChartOverlays = {
  sma: boolean;
  ema: boolean;
  rsi: boolean;
  macd: boolean;
};

export type AnalysisChartProps = {
  prices: DailyPriceDto[];
  indicatorPoints: IndicatorSeriesPoint[];
  overlays?: AnalysisChartOverlays;
  loading?: boolean;
  /** チャート領域の高さ（px）。省略時は 520。 */
  height?: number;
};

export const DEFAULT_OVERLAYS: AnalysisChartOverlays = {
  sma: true,
  ema: true,
  rsi: true,
  macd: true,
};

const UP_COLOR = '#26a69a';
const DOWN_COLOR = '#ef5350';
const SMA_COLOR = '#f5c542';
const EMA_COLOR = '#7eb8ff';
const RSI_COLOR = '#c79bff';
const MACD_COLOR = '#7eb8ff';
const MACD_SIGNAL_COLOR = '#f5c542';
const MACD_HIST_UP = 'rgba(38, 166, 154, 0.55)';
const MACD_HIST_DOWN = 'rgba(239, 83, 80, 0.55)';

/** ローソク足シリーズ用データへ変換する。 */
export function toCandlestickData(prices: DailyPriceDto[]) {
  return prices.map((price) => ({
    time: price.date as Time,
    open: price.open,
    high: price.high,
    low: price.low,
    close: price.close,
  }));
}

/** 出来高ヒストグラム（上昇/下落色分け）へ変換する。 */
export function toVolumeData(prices: DailyPriceDto[]) {
  return prices.map((price) => ({
    time: price.date as Time,
    value: price.volume,
    color: price.close >= price.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
  }));
}

/**
 * 指標ポイントから null を除いた線系列を作る。
 * ウォームアップ中の null は lightweight-charts に渡さない。
 */
export function toLineData(
  points: IndicatorSeriesPoint[],
  key: 'sma' | 'ema' | 'rsi' | 'macd' | 'macdSignal',
) {
  const data: { time: Time; value: number }[] = [];
  for (const point of points) {
    const value = point[key];
    if (typeof value === 'number') {
      data.push({ time: point.date as Time, value });
    }
  }
  return data;
}

/** MACD ヒストグラム（符号で色分け）。 */
export function toMacdHistogramData(points: IndicatorSeriesPoint[]) {
  const data: { time: Time; value: number; color: string }[] = [];
  for (const point of points) {
    const value = point.macdHistogram;
    if (typeof value === 'number') {
      data.push({
        time: point.date as Time,
        value,
        color: value >= 0 ? MACD_HIST_UP : MACD_HIST_DOWN,
      });
    }
  }
  return data;
}

/** 価格・指標をまとめた分析チャート。空／読込中はメッセージのみ返す。 */
export function AnalysisChart({
  prices,
  indicatorPoints,
  overlays = DEFAULT_OVERLAYS,
  loading = false,
  height = 520,
}: AnalysisChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loading || prices.length === 0 || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#12263a' },
        textColor: '#e8eef5',
      },
      grid: {
        vertLines: { color: 'rgba(232, 238, 245, 0.08)' },
        horzLines: { color: 'rgba(232, 238, 245, 0.08)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    // Pane 0: ローソク
    const candles = chart.addSeries(
      CandlestickSeries,
      {
        upColor: UP_COLOR,
        downColor: DOWN_COLOR,
        borderVisible: false,
        wickUpColor: UP_COLOR,
        wickDownColor: DOWN_COLOR,
      },
      0,
    );
    candles.setData(toCandlestickData(prices));

    if (overlays.sma) {
      const sma = chart.addSeries(
        LineSeries,
        { color: SMA_COLOR, lineWidth: 2, title: 'SMA', priceLineVisible: false },
        0,
      );
      sma.setData(toLineData(indicatorPoints, 'sma'));
    }

    if (overlays.ema) {
      const ema = chart.addSeries(
        LineSeries,
        { color: EMA_COLOR, lineWidth: 2, title: 'EMA', priceLineVisible: false },
        0,
      );
      ema.setData(toLineData(indicatorPoints, 'ema'));
    }

    // Pane 1: Volume
    const volume = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        title: 'Volume',
      },
      1,
    ) as ISeriesApi<'Histogram'>;
    volume.setData(toVolumeData(prices));

    // Pane 2: RSI（トグル OFF でも空パネルを作らず、ON のときだけ追加）
    let nextPane = 2;
    if (overlays.rsi) {
      const rsi = chart.addSeries(
        LineSeries,
        { color: RSI_COLOR, lineWidth: 2, title: 'RSI', priceLineVisible: false },
        nextPane,
      );
      rsi.setData(toLineData(indicatorPoints, 'rsi'));
      nextPane += 1;
    }

    if (overlays.macd) {
      const macdLine = chart.addSeries(
        LineSeries,
        { color: MACD_COLOR, lineWidth: 2, title: 'MACD', priceLineVisible: false },
        nextPane,
      );
      macdLine.setData(toLineData(indicatorPoints, 'macd'));

      const signal = chart.addSeries(
        LineSeries,
        { color: MACD_SIGNAL_COLOR, lineWidth: 2, title: 'Signal', priceLineVisible: false },
        nextPane,
      );
      signal.setData(toLineData(indicatorPoints, 'macdSignal'));

      const hist = chart.addSeries(
        HistogramSeries,
        { title: 'Hist', priceLineVisible: false },
        nextPane,
      );
      hist.setData(toMacdHistogramData(indicatorPoints));
    }

    // サブパネルの高さを抑える（価格パネルを主に）
    const panes = chart.panes();
    if (panes.length > 1) {
      panes[0]?.setHeight(Math.round(height * 0.45));
      for (let i = 1; i < panes.length; i += 1) {
        panes[i]?.setHeight(Math.round(height * 0.18));
      }
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      // container は effect 開始時に確定しているので、ここでも同じ参照を使う
      chart.applyOptions({ width: container.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [prices, indicatorPoints, overlays, loading, height]);

  if (loading) {
    return <p style={messageStyle}>チャートを読み込み中…</p>;
  }

  if (prices.length === 0) {
    return <p style={messageStyle}>この期間の価格データがありません</p>;
  }

  return (
    <div
      data-testid="analysis-chart"
      ref={containerRef}
      style={{ ...chartWrapStyle, height }}
    />
  );
}

const messageStyle: CSSProperties = { margin: '0.5rem 0', opacity: 0.85 };
const chartWrapStyle: CSSProperties = { width: '100%', marginTop: '0.75rem' };
