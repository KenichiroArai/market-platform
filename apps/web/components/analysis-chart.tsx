/**
 * チャート分析用のローソク足コンポーネント（ADR 005 / 006）。
 *
 * TradingView lightweight-charts v5 でローソク・出来高・カタログ指標を描画する。
 * Volume Profile と一目の雲は価格ペイン上の HTML オーバーレイ。
 * トレンドスコアは series primitive で価格ペイン背景に塗る（ADR 007）。
 */
'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import {
  INDICATOR_CATALOG,
  INDICATOR_CATALOG_BY_ID,
  trendScoreState,
  type DailyPriceDto,
  type IndicatorCatalogId,
  type IndicatorDrawings,
  type IndicatorSeriesPoint,
  type TrendScorePoint,
  type VolumeProfileBin,
} from '@market/shared-types';
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
import { TrendBackgroundPrimitive } from './trend-background-primitive';

export type AnalysisChartProps = {
  prices: DailyPriceDto[];
  indicatorPoints: IndicatorSeriesPoint[];
  enabledIds?: Set<IndicatorCatalogId>;
  drawings?: IndicatorDrawings;
  trendScorePoints?: TrendScorePoint[];
  loading?: boolean;
  height?: number;
};

const UP_COLOR = '#26a69a';
const DOWN_COLOR = '#ef5350';
const MACD_HIST_UP = 'rgba(38, 166, 154, 0.55)';
const MACD_HIST_DOWN = 'rgba(239, 83, 80, 0.55)';
const PRICE_PANE_PX = 320;
const SUB_PANE_PX = 90;

/** サブペイン数に応じたチャート高さ。 */
export function computeAnalysisChartHeight(enabledIds: Set<IndicatorCatalogId>): number {
  const volumeOn = enabledIds.has('volume');
  let oscillators = 0;
  for (const def of INDICATOR_CATALOG) {
    if (def.pane === 'oscillator' && enabledIds.has(def.id)) {
      oscillators += 1;
    }
  }
  return PRICE_PANE_PX + (volumeOn ? SUB_PANE_PX : 0) + oscillators * SUB_PANE_PX;
}

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
export function toLineData(points: IndicatorSeriesPoint[], key: string) {
  const data: { time: Time; value: number }[] = [];
  for (const point of points) {
    const value = point.values[key];
    if (typeof value === 'number') {
      data.push({ time: point.date as Time, value });
    }
  }
  return data;
}

/** 符号で色分けしたヒストグラム。 */
export function toSignedHistogramData(points: IndicatorSeriesPoint[], key: string) {
  const data: { time: Time; value: number; color: string }[] = [];
  for (const point of points) {
    const value = point.values[key];
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

/** MACD ヒストグラム（符号で色分け）。 */
export function toMacdHistogramData(points: IndicatorSeriesPoint[]) {
  return toSignedHistogramData(points, 'macdHistogram');
}

/** Volume Profile を価格ペイン右端に置くためのレイアウト。 */
export function volumeProfileLayout(
  bins: VolumeProfileBin[],
  pricePaneRatio: number,
): { topPct: number; heightPct: number; widthPct: number }[] {
  if (bins.length === 0) {
    return [];
  }
  const priceMin = Math.min(...bins.map((bin) => bin.priceLow));
  const priceMax = Math.max(...bins.map((bin) => bin.priceHigh));
  const span = priceMax - priceMin;
  const maxVol = Math.max(...bins.map((bin) => bin.volume), 0);
  if (span === 0 || maxVol === 0) {
    return bins.map(() => ({
      topPct: 0,
      heightPct: pricePaneRatio * 100,
      widthPct: maxVol === 0 ? 0 : 18,
    }));
  }
  return bins.map((bin) => ({
    topPct: ((priceMax - bin.priceHigh) / span) * pricePaneRatio * 100,
    heightPct: ((bin.priceHigh - bin.priceLow) / span) * pricePaneRatio * 100,
    widthPct: (bin.volume / maxVol) * 18,
  }));
}

/** 一目の雲（先行A/B の間）を価格レンジ比で塗る。 */
export function ichimokuCloudSegments(
  points: IndicatorSeriesPoint[],
  priceMin: number,
  priceMax: number,
  pricePaneRatio: number,
): { leftPct: number; widthPct: number; topPct: number; heightPct: number; bullish: boolean }[] {
  const span = priceMax - priceMin;
  if (points.length === 0 || span === 0) {
    return [];
  }
  const segments: {
    leftPct: number;
    widthPct: number;
    topPct: number;
    heightPct: number;
    bullish: boolean;
  }[] = [];
  const widthPct = 100 / points.length;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]?.values.ichimokuSenkouA;
    const b = points[i]?.values.ichimokuSenkouB;
    if (typeof a !== 'number' || typeof b !== 'number') {
      continue;
    }
    const high = Math.max(a, b);
    const low = Math.min(a, b);
    segments.push({
      leftPct: i * widthPct,
      widthPct,
      topPct: ((priceMax - high) / span) * pricePaneRatio * 100,
      heightPct: ((high - low) / span) * pricePaneRatio * 100,
      bullish: a >= b,
    });
  }
  return segments;
}

/** 直近の有効な総合スコア。全て null なら null。 */
export function latestScoredPoint(points: TrendScorePoint[]): TrendScorePoint | null {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i];
    if (point !== undefined && point.score !== null) {
      return point;
    }
  }
  return null;
}

/** 価格・指標をまとめた分析チャート。空／読込中はメッセージのみ返す。 */
export function AnalysisChart({
  prices,
  indicatorPoints,
  enabledIds = new Set(),
  drawings,
  trendScorePoints = [],
  loading = false,
  height,
}: AnalysisChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartHeight = height ?? computeAnalysisChartHeight(enabledIds);
  const volumeOn = enabledIds.has('volume');
  const pricePaneRatio = PRICE_PANE_PX / chartHeight;
  const priceMin = prices.length === 0 ? 0 : Math.min(...prices.map((p) => p.low));
  const priceMax = prices.length === 0 ? 1 : Math.max(...prices.map((p) => p.high));
  const vpLayout =
    enabledIds.has('volumeProfile') && drawings?.volumeProfile
      ? volumeProfileLayout(drawings.volumeProfile.bins, pricePaneRatio)
      : [];
  const cloud =
    enabledIds.has('ichimoku')
      ? ichimokuCloudSegments(indicatorPoints, priceMin, priceMax, pricePaneRatio)
      : [];

  useEffect(() => {
    if (loading || prices.length === 0 || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: chartHeight,
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
    ) as ISeriesApi<'Candlestick'> & {
      createPriceLine?: (opts: { price: number; color: string; title: string }) => void;
      attachPrimitive?: (primitive: TrendBackgroundPrimitive) => void;
    };
    candles.setData(toCandlestickData(prices));

    if (trendScorePoints.length > 0 && typeof candles.attachPrimitive === 'function') {
      candles.attachPrimitive(new TrendBackgroundPrimitive(trendScorePoints));
    }

    if (enabledIds.has('fibonacci') && drawings?.fibonacci) {
      for (const level of drawings.fibonacci.levels) {
        candles.createPriceLine?.({
          price: level.price,
          color: 'rgba(232, 238, 245, 0.45)',
          title: `${(level.ratio * 100).toFixed(1)}%`,
        });
      }
    }

    for (const def of INDICATOR_CATALOG) {
      if (!enabledIds.has(def.id) || def.pane !== 'overlay') {
        continue;
      }
      for (const series of def.series) {
        const line = chart.addSeries(
          LineSeries,
          {
            color: series.color,
            lineWidth: (series.style === 'dots' ? 1 : 2) as 1 | 2,
            title: series.label,
            priceLineVisible: false,
          },
          0,
        );
        line.setData(toLineData(indicatorPoints, series.key));
      }
    }

    let nextPane = 1;
    if (volumeOn) {
      const volume = chart.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
          title: 'Volume',
        },
        nextPane,
      ) as ISeriesApi<'Histogram'>;
      volume.setData(toVolumeData(prices));
      nextPane += 1;
    }

    for (const def of INDICATOR_CATALOG) {
      if (!enabledIds.has(def.id) || def.pane !== 'oscillator') {
        continue;
      }
      for (const series of def.series) {
        if (series.style === 'histogram') {
          const hist = chart.addSeries(
            HistogramSeries,
            { title: series.label, priceLineVisible: false },
            nextPane,
          );
          hist.setData(toSignedHistogramData(indicatorPoints, series.key));
        } else {
          const line = chart.addSeries(
            LineSeries,
            {
              color: series.color,
              lineWidth: 2,
              title: series.label,
              priceLineVisible: false,
            },
            nextPane,
          );
          line.setData(toLineData(indicatorPoints, series.key));
        }
      }
      nextPane += 1;
    }

    const panes = chart.panes();
    if (panes.length > 1) {
      panes[0]?.setHeight(PRICE_PANE_PX);
      for (let i = 1; i < panes.length; i += 1) {
        panes[i]?.setHeight(SUB_PANE_PX);
      }
    }

    chart.timeScale().fitContent();

    // 別ウィンドウへ portal したときは popup 側の resize を見る
    const view = resolveOwnerWindow(container);
    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };
    view.addEventListener('resize', handleResize);

    return () => {
      view.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [prices, indicatorPoints, enabledIds, drawings, trendScorePoints, loading, chartHeight, volumeOn]);

  if (loading) {
    return <p style={messageStyle}>チャートを読み込み中…</p>;
  }

  if (prices.length === 0) {
    return <p style={messageStyle}>この期間の価格データがありません</p>;
  }

  const latestScore = latestScoredPoint(trendScorePoints);

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: '0.75rem' }}>
      {latestScore !== null && latestScore.score !== null ? (
        <p data-testid="trend-score-label" style={scoreLabelStyle}>
          トレンドスコア {Math.round(latestScore.score)}（{trendScoreState(latestScore.score).labelJa}）
        </p>
      ) : null}
      <div
        data-testid="analysis-chart"
        ref={containerRef}
        style={{ ...chartWrapStyle, height: chartHeight }}
      />
      {cloud.map((seg, index) => (
        <div
          key={`cloud-${index}`}
          data-testid="ichimoku-cloud-seg"
          style={{
            position: 'absolute',
            left: `${seg.leftPct}%`,
            top: `${seg.topPct}%`,
            width: `${seg.widthPct}%`,
            height: `${seg.heightPct}%`,
            background: seg.bullish ? 'rgba(105, 240, 174, 0.12)' : 'rgba(255, 82, 82, 0.12)',
            pointerEvents: 'none',
          }}
        />
      ))}
      {vpLayout.map((bar, index) => (
        <div
          key={`vp-${index}`}
          data-testid="volume-profile-bar"
          style={{
            position: 'absolute',
            right: 0,
            top: `${bar.topPct}%`,
            width: `${bar.widthPct}%`,
            height: `${bar.heightPct}%`,
            background: 'rgba(77, 182, 172, 0.35)',
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
}

const messageStyle: CSSProperties = { margin: '0.5rem 0', opacity: 0.85 };
const scoreLabelStyle: CSSProperties = { margin: '0 0 0.4rem', fontSize: '0.9rem', opacity: 0.9 };
const chartWrapStyle: CSSProperties = { width: '100%' };

export function isOverlayEnabled(
  enabledIds: Set<IndicatorCatalogId>,
  id: IndicatorCatalogId,
): boolean {
  return enabledIds.has(id) && INDICATOR_CATALOG_BY_ID[id].pane !== 'none';
}

/** チャート要素が属する Window。popup の defaultView が無いときは opener に落とす。 */
export function resolveOwnerWindow(node: {
  ownerDocument: { defaultView: Window | null };
}): Window {
  return node.ownerDocument.defaultView ?? window;
}
