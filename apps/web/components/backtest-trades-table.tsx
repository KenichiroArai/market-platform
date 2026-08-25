/**
 * バックテストの取引履歴テーブル。
 */
'use client';

import type { CSSProperties } from 'react';
import type { BacktestTradeDto } from '@market/shared-types';

export type BacktestTradesTableProps = {
  trades: BacktestTradeDto[];
};

/** 約定一覧。entry/exit・損益を表形式で表示する。 */
export function BacktestTradesTable({ trades }: BacktestTradesTableProps) {
  if (trades.length === 0) {
    return <p style={messageStyle}>取引はありません</p>;
  }

  return (
    <div data-testid="trades-table" style={wrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Entry</th>
            <th style={thStyle}>Exit</th>
            <th style={thStyle}>Entry価格</th>
            <th style={thStyle}>Exit価格</th>
            <th style={thStyle}>数量</th>
            <th style={thStyle}>純損益</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id}>
              <td style={tdStyle}>{trade.entryDate}</td>
              <td style={tdStyle}>{trade.exitDate}</td>
              <td style={tdStyle}>{trade.entryPrice.toFixed(2)}</td>
              <td style={tdStyle}>{trade.exitPrice.toFixed(2)}</td>
              <td style={tdStyle}>{trade.quantity.toFixed(4)}</td>
              <td style={tdStyle}>{trade.netPnl.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const messageStyle: CSSProperties = { margin: '0.5rem 0', opacity: 0.85 };
const wrapStyle: CSSProperties = { overflowX: 'auto', marginTop: '0.75rem' };
const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
};
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.35)',
  opacity: 0.85,
};
const tdStyle: CSSProperties = {
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.15)',
};
