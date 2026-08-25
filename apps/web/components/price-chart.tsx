/**
 * 日足終値の折れ線チャート。
 * バックテスト結果の売買ポイント（▲Buy・▼Sell）を重ねて表示できる。
 */
'use client';

import type { CSSProperties } from 'react';
import type { BacktestTradeDto, DailyPriceDto } from '@market/shared-types';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type PriceChartProps = {
  prices: DailyPriceDto[];
  loading?: boolean;
  /** 選択中バックテストの約定。entry=Buy、exit=Sell マーカーに使う */
  trades?: BacktestTradeDto[];
};

type ChartPoint = {
  date: string;
  close: number;
  buy?: number;
  sell?: number;
};

type MarkerProps = {
  cx?: number;
  cy?: number;
};

/** ▲ Buy マーカー（Scatter の shape として描画） */
/* istanbul ignore next -- SVG marker; covered via Scatter wiring in chart tests */
export function BuyMarker({ cx = 0, cy = 0 }: MarkerProps) {
  return (
    <polygon
      points={`${cx},${cy - 7} ${cx - 6},${cy + 5} ${cx + 6},${cy + 5}`}
      fill="#3dd68c"
      data-testid="buy-marker"
    />
  );
}

/** ▼ Sell マーカー（Scatter の shape として描画） */
/* istanbul ignore next -- SVG marker; covered via Scatter wiring in chart tests */
export function SellMarker({ cx = 0, cy = 0 }: MarkerProps) {
  return (
    <polygon
      points={`${cx},${cy + 7} ${cx - 6},${cy - 5} ${cx + 6},${cy - 5}`}
      fill="#ff8a80"
      data-testid="sell-marker"
    />
  );
}

/** date × close の簡易折れ線。売買ポイントがあれば ▲/▼ を重ねる。 */
export function PriceChart({ prices, loading = false, trades = [] }: PriceChartProps) {
  if (loading) {
    return <p style={messageStyle}>価格を読み込み中…</p>;
  }

  if (prices.length === 0) {
    return <p style={messageStyle}>この期間の価格データがありません</p>;
  }

  const buyByDate = new Map<string, number>();
  const sellByDate = new Map<string, number>();
  for (const trade of trades) {
    buyByDate.set(trade.entryDate, trade.entryPrice);
    sellByDate.set(trade.exitDate, trade.exitPrice);
  }

  const data: ChartPoint[] = prices.map((price) => ({
    date: price.date,
    close: price.close,
    buy: buyByDate.get(price.date),
    sell: sellByDate.get(price.date),
  }));

  const buyPoints = data.filter((point) => point.buy !== undefined);
  const sellPoints = data.filter((point) => point.sell !== undefined);

  return (
    <div data-testid="price-chart" style={chartWrapStyle}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(232, 238, 245, 0.15)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#e8eef5', fontSize: 11 }} minTickGap={32} />
          <YAxis
            tick={{ fill: '#e8eef5', fontSize: 11 }}
            domain={['auto', 'auto']}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: '#1a334d',
              border: '1px solid rgba(232, 238, 245, 0.35)',
              color: '#e8eef5',
            }}
          />
          <Line
            type="monotone"
            dataKey="close"
            name="終値"
            stroke="#7eb8ff"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Scatter
            name="▲Buy"
            data={buyPoints}
            dataKey="buy"
            shape={<BuyMarker />}
            isAnimationActive={false}
          />
          <Scatter
            name="▼Sell"
            data={sellPoints}
            dataKey="sell"
            shape={<SellMarker />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const messageStyle: CSSProperties = { margin: '0.5rem 0', opacity: 0.85 };
const chartWrapStyle: CSSProperties = { width: '100%', height: 280, marginTop: '0.75rem' };
