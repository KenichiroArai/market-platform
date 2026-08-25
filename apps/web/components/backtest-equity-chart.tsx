/**
 * バックテストのエクイティカーブ。
 * 戦略資産と Buy & Hold 資産を並べて比較する。
 */
'use client';

import type { CSSProperties } from 'react';
import type { BacktestEquityPointDto, DailyPriceDto } from '@market/shared-types';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type BacktestEquityChartProps = {
  equityPoints: BacktestEquityPointDto[];
  prices: DailyPriceDto[];
  initialCash: number;
};

/** エクイティと Buy&Hold（初日終値で全額買い）の折れ線。 */
export function BacktestEquityChart({
  equityPoints,
  prices,
  initialCash,
}: BacktestEquityChartProps) {
  if (equityPoints.length === 0) {
    return <p style={messageStyle}>エクイティデータがありません</p>;
  }

  const firstClose = prices[0]?.close;
  const quantity = firstClose && firstClose > 0 ? initialCash / firstClose : 0;
  const priceByDate = new Map(prices.map((price) => [price.date, price.close]));

  const data = equityPoints.map((point) => {
    const close = priceByDate.get(point.date);
    const buyHold = close !== undefined && quantity > 0 ? quantity * close : undefined;
    return {
      date: point.date,
      equity: point.equity,
      buyHold,
    };
  });

  return (
    <div data-testid="equity-chart" style={chartWrapStyle}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(232, 238, 245, 0.15)" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: '#e8eef5', fontSize: 11 }} minTickGap={32} />
          <YAxis tick={{ fill: '#e8eef5', fontSize: 11 }} domain={['auto', 'auto']} width={64} />
          <Tooltip
            contentStyle={{
              background: '#1a334d',
              border: '1px solid rgba(232, 238, 245, 0.35)',
              color: '#e8eef5',
            }}
          />
          <Legend wrapperStyle={{ color: '#e8eef5' }} />
          <Line
            type="monotone"
            dataKey="equity"
            name="戦略"
            stroke="#7eb8ff"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="buyHold"
            name="Buy & Hold"
            stroke="#ffb74d"
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
const chartWrapStyle: CSSProperties = { width: '100%', height: 240, marginTop: '0.75rem' };
