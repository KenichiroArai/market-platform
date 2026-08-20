/**
 * チャート分析用のローソク足コンポーネント（ADR 005 / 006）。
 *
 * TradingView lightweight-charts v5 でローソク・出来高・カタログ指標を描画する。
 * Volume Profile は価格ペイン上の HTML オーバーレイ。
 * 一目の雲とトレンドスコアは series primitive で価格ペインに描く（ADR 007）。
 * バークリックで基準日を通知し、スコアラベルは基準日の点を表示する（Ph6）。
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
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import { TrendBackgroundPrimitive } from './trend-background-primitive';
import { IchimokuCloudPrimitive } from './ichimoku-cloud-primitive';

export type AnalysisChartProps = {
  prices: DailyPriceDto[];
  indicatorPoints: IndicatorSeriesPoint[];
  enabledIds?: Set<IndicatorCatalogId>;
  drawings?: IndicatorDrawings;
  trendScorePoints?: TrendScorePoint[];
  /** スコア表示の基準日。未指定時は直近の有効スコア日。 */
  baseDate?: string | null;
  /** チャート上のバーをクリックしたときの日付（YYYY-MM-DD）。 */
  onBarClick?: (date: string) => void;
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

/**
 * 基準日のスコア点を返す。基準日が無い／見つからないときは直近の有効点。
 * 基準日に点はあるが score が null の場合もその点を返す（内訳表示用）。
 */
export function resolveScoredPoint(
  points: TrendScorePoint[],
  baseDate: string | null | undefined,
): TrendScorePoint | null {
  if (baseDate) {
    const found = points.find((point) => point.date === baseDate);
    if (found !== undefined) {
      return found;
    }
  }
  return latestScoredPoint(points);
}

/** lightweight-charts の Time を YYYY-MM-DD にする。 */
export function chartTimeToDateString(time: Time): string | null {
  if (typeof time === 'string') {
    return time;
  }
  if (typeof time === 'number') {
    return new Date(time * 1000).toISOString().slice(0, 10);
  }
  if (
    time !== null &&
    typeof time === 'object' &&
    'year' in time &&
    'month' in time &&
    'day' in time
  ) {
    const year = time.year;
    const month = String(time.month).padStart(2, '0');
    const day = String(time.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
  baseDate = null,
  onBarClick,
  loading = false,
  height,
}: AnalysisChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onBarClickRef = useRef(onBarClick);
  onBarClickRef.current = onBarClick;
  const chartHeight = height ?? computeAnalysisChartHeight(enabledIds);
  const volumeOn = enabledIds.has('volume');
  const pricePaneRatio = PRICE_PANE_PX / chartHeight;
  const vpLayout =
    enabledIds.has('volumeProfile') && drawings?.volumeProfile
      ? volumeProfileLayout(drawings.volumeProfile.bins, pricePaneRatio)
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

    if (typeof candles.attachPrimitive === 'function') {
      if (trendScorePoints.length > 0) {
        candles.attachPrimitive(new TrendBackgroundPrimitive(trendScorePoints));
      }
      if (enabledIds.has('ichimoku')) {
        candles.attachPrimitive(new IchimokuCloudPrimitive(indicatorPoints));
      }
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

    // クリックで基準日を親へ通知（Ph6）
    const handleClick = (param: MouseEventParams) => {
      if (param.time === undefined) {
        return;
      }
      const date = chartTimeToDateString(param.time);
      if (date !== null) {
        onBarClickRef.current?.(date);
      }
    };
    chart.subscribeClick(handleClick);

    // 別ウィンドウへ portal したときは popup 側の resize を見る
    const view = resolveOwnerWindow(container);
    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };
    view.addEventListener('resize', handleResize);

    return () => {
      chart.unsubscribeClick(handleClick);
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

  const scored = resolveScoredPoint(trendScorePoints, baseDate);

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: '0.75rem' }}>
      {scored !== null && scored.score !== null ? (
        <p data-testid="trend-score-label" style={scoreLabelStyle}>
          <span data-testid="trend-score-base-date">基準日 {scored.date}　</span>
          トレンドスコア {Math.round(scored.score)}（{trendScoreState(scored.score).labelJa}）
        </p>
      ) : baseDate ? (
        <p data-testid="trend-score-label" style={scoreLabelStyle}>
          <span data-testid="trend-score-base-date">基準日 {baseDate}</span>
          {'　スコアなし'}
        </p>
      ) : null}
      <div style={{ ...chartOverlayRootStyle, height: chartHeight }}>
        <div
          data-testid="analysis-chart"
          ref={containerRef}
          style={{ ...chartWrapStyle, height: chartHeight }}
        />
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
    </div>
  );
}

const messageStyle: CSSProperties = { margin: '0.5rem 0', opacity: 0.85 };
const scoreLabelStyle: CSSProperties = { margin: '0 0 0.4rem', fontSize: '0.9rem', opacity: 0.9 };
const chartOverlayRootStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  overflow: 'hidden',
};
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
