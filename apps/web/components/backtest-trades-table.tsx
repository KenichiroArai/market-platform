/**
 * バックテストの取引履歴テーブル（v0.4.0 Ph3）。
 *
 * 日付・価格・損益に加え、買い／売り判断（理由コードの日本語）を表示する。
 * スコア戦略ではエントリー／エグジットスコア列を出し、トレンドスコア戦略では
 * グループ寄与・指標ごとの内訳列も追加する。理由セルにはスコアを重ねずラベルのみ。
 */
'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  formatTradeReason,
  type BacktestTradeDto,
  type SignalStrategyType,
} from '@market/shared-types';
import {
  formatGroupCell,
  formatIndicatorCell,
  formatScoreCell,
  scoreColumnHeader,
  scoreGroupColumns,
  scoreIndicatorColumns,
} from '../lib/backtest-score-columns';

export type BacktestTradesTableProps = {
  trades: BacktestTradeDto[];
  /** 実行の戦略。スコア列の出し分けに使う。 */
  strategyType?: SignalStrategyType;
  /** 資金管理列を表示する（MM ON の Run）。 */
  showMoneyManagement?: boolean;
};

/** 約定一覧。entry/exit・判断・損益・スコアを表形式で表示する。 */
export function BacktestTradesTable({
  trades,
  strategyType,
  showMoneyManagement = false,
}: BacktestTradesTableProps) {
  if (trades.length === 0) {
    return <p style={messageStyle}>取引はありません</p>;
  }

  const showScoreColumns =
    strategyType === 'rsiThreshold' ||
    strategyType === 'trendScoreThreshold' ||
    trades.some((t) => t.entryScore != null || t.exitScore != null);

  const showBreakdownColumns =
    strategyType === 'trendScoreThreshold' &&
    trades.some((t) => t.entryScoreBreakdown != null || t.exitScoreBreakdown != null);

  const groupCols = showBreakdownColumns ? scoreGroupColumns() : [];
  const indicatorCols = showBreakdownColumns ? scoreIndicatorColumns() : [];
  const wideTable = showScoreColumns || showBreakdownColumns || showMoneyManagement;

  return (
    <div data-testid="trades-table" style={wrapStyle}>
      <table style={wideTable ? wideTableStyle : tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>エントリー日</th>
            <th style={thStyle}>エグジット日</th>
            <th style={thStyle}>エントリー価格</th>
            <th style={thStyle}>エグジット価格</th>
            <th style={thStyle}>数量</th>
            <th style={thStyle}>方向</th>
            <th style={thStyle}>買い判断</th>
            <th style={thStyle}>売り判断</th>
            {showMoneyManagement ? (
              <>
                <th style={thStyle}>ATR</th>
                <th style={thStyle}>N</th>
                <th style={thStyle}>リスク率</th>
                <th style={thStyle}>初回数量</th>
                <th style={thStyle}>追加回数</th>
                <th style={thStyle}>ストップ</th>
                <th style={thStyle}>ユニット</th>
              </>
            ) : null}
            {showScoreColumns ? (
              <>
                <th style={thStyle}>エントリースコア</th>
                <th style={thStyle}>エグジットスコア</th>
              </>
            ) : null}
            {groupCols.flatMap((col) => [
              <th key={`entry-group-${col.id}`} style={thStyle}>
                {scoreColumnHeader('entry', col.label)}
              </th>,
              <th key={`exit-group-${col.id}`} style={thStyle}>
                {scoreColumnHeader('exit', col.label)}
              </th>,
            ])}
            {indicatorCols.flatMap((col) => [
              <th key={`entry-${col.id}`} style={thStyle}>
                {scoreColumnHeader('entry', col.label)}
              </th>,
              <th key={`exit-${col.id}`} style={thStyle}>
                {scoreColumnHeader('exit', col.label)}
              </th>,
            ])}
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
              <td style={tdStyle}>{trade.side === 'sell' ? 'ショート' : 'ロング'}</td>
              <td style={tdStyle} data-testid={`trade-entry-reason-${trade.id}`}>
                {formatTradeReason(trade.entryReason)}
              </td>
              <td style={tdStyle} data-testid={`trade-exit-reason-${trade.id}`}>
                {formatTradeReason(trade.exitReason)}
              </td>
              {showMoneyManagement ? (
                <>
                  <td style={tdStyle}>{trade.atr == null ? '' : trade.atr.toFixed(2)}</td>
                  <td style={tdStyle}>{trade.n == null ? '' : trade.n.toFixed(2)}</td>
                  <td style={tdStyle}>
                    {trade.riskRate == null ? '' : `${(trade.riskRate * 100).toFixed(2)}%`}
                  </td>
                  <td style={tdStyle}>
                    {trade.initialQuantity == null ? '' : trade.initialQuantity.toFixed(4)}
                  </td>
                  <td style={tdStyle}>{trade.addCount == null ? '' : trade.addCount}</td>
                  <td style={tdStyle}>
                    {trade.stopPrice == null ? '' : trade.stopPrice.toFixed(2)}
                  </td>
                  <td style={tdStyle}>{trade.unitCount == null ? '' : trade.unitCount}</td>
                </>
              ) : null}
              {showScoreColumns ? (
                <>
                  <td style={tdStyle} data-testid={`trade-entry-score-${trade.id}`}>
                    {formatScoreCell(trade.entryScore)}
                  </td>
                  <td style={tdStyle} data-testid={`trade-exit-score-${trade.id}`}>
                    {formatScoreCell(trade.exitScore)}
                  </td>
                </>
              ) : null}
              {groupCols.flatMap((col): ReactNode[] => [
                <td
                  key={`entry-group-${col.id}-${trade.id}`}
                  style={tdStyle}
                  data-testid={`trade-entry-group-${col.id}-${trade.id}`}
                >
                  {formatGroupCell(trade.entryScoreBreakdown, col.id)}
                </td>,
                <td
                  key={`exit-group-${col.id}-${trade.id}`}
                  style={tdStyle}
                  data-testid={`trade-exit-group-${col.id}-${trade.id}`}
                >
                  {formatGroupCell(trade.exitScoreBreakdown, col.id)}
                </td>,
              ])}
              {indicatorCols.flatMap((col): ReactNode[] => [
                <td
                  key={`entry-${col.id}-${trade.id}`}
                  style={tdStyle}
                  data-testid={`trade-entry-breakdown-${col.id}-${trade.id}`}
                >
                  {formatIndicatorCell(trade.entryScoreBreakdown, col.id)}
                </td>,
                <td
                  key={`exit-${col.id}-${trade.id}`}
                  style={tdStyle}
                  data-testid={`trade-exit-breakdown-${col.id}-${trade.id}`}
                >
                  {formatIndicatorCell(trade.exitScoreBreakdown, col.id)}
                </td>,
              ])}
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
const wideTableStyle: CSSProperties = {
  ...tableStyle,
  width: 'max-content',
  minWidth: '100%',
};
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.35)',
  opacity: 0.85,
  whiteSpace: 'nowrap',
};
const tdStyle: CSSProperties = {
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.15)',
  whiteSpace: 'nowrap',
};
