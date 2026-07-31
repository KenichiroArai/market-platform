/**
 * 日足終値の折れ線チャート。
 * 銘柄選択・期間指定後の値動き確認用。空／読込中はメッセージのみ返す。
 */
'use client';

import type { CSSProperties } from 'react';
import type { DailyPriceDto } from '@market/shared-types';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type PriceChartProps = {
  prices: DailyPriceDto[];
  loading?: boolean;
};

/** date × close の簡易折れ線。データ無し／読込中はメッセージを返す。 */
export function PriceChart({ prices, loading = false }: PriceChartProps) {
  if (loading) {
    return <p style={messageStyle}>価格を読み込み中…</p>;
  }

  if (prices.length === 0) {
    return <p style={messageStyle}>この期間の価格データがありません</p>;
  }

  const data = prices.map((price) => ({
    date: price.date,
    close: price.close,
  }));

  return (
    <div data-testid="price-chart" style={chartWrapStyle}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const messageStyle: CSSProperties = { margin: '0.5rem 0', opacity: 0.85 };
const chartWrapStyle: CSSProperties = { width: '100%', height: 280, marginTop: '0.75rem' };
