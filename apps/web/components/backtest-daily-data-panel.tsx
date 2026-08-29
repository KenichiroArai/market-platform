/**
 * バックテスト結果の日次データパネル（v0.4.0 Ph3）。
 *
 * サマリー条件と、equityPoints × 価格を結合した明細一覧を表示する。
 * スコア内訳がある Run ではグループ寄与・指標列も出す。
 */
'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  formatStrategyLabel,
  type BacktestRunDto,
  type BacktestTradeDto,
  type DailyPriceDto,
} from '@market/shared-types';
import { BacktestSummaryCards } from './backtest-summary-cards';
import {
  formatGroupCell,
  formatIndicatorCell,
  formatScoreCell,
  scoreGroupColumns,
  scoreIndicatorColumns,
} from '../lib/backtest-score-columns';

export type BacktestDailyDataPanelProps = {
  run: BacktestRunDto;
  prices: DailyPriceDto[];
  symbolLabel?: string | null;
  indicatorSetName?: string | null;
  onDownloadZip?: () => void;
};

/** 日付キーで価格を引くための Map。 */
function priceByDate(prices: DailyPriceDto[]): Map<string, DailyPriceDto> {
  const map = new Map<string, DailyPriceDto>();
  for (const price of prices) {
    map.set(price.date, price);
  }
  return map;
}

/** その日の売買イベント文字列（同日は buy;sell）。 */
function tradeEventForDate(date: string, trades: BacktestTradeDto[]): string {
  const hasBuy = trades.some((t) => t.entryDate === date);
  const hasSell = trades.some((t) => t.exitDate === date);
  if (hasBuy && hasSell) {
    return 'buy;sell';
  }
  if (hasBuy) {
    return 'buy';
  }
  if (hasSell) {
    return 'sell';
  }
  return '';
}

function pctRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function cashLabel(value: number): string {
  return value.toLocaleString('ja-JP');
}

function numCell(value: number | undefined | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) {
    return '';
  }
  return value.toFixed(digits);
}

/** 日次データタブの本体。 */
export function BacktestDailyDataPanel({
  run,
  prices,
  symbolLabel,
  indicatorSetName,
  onDownloadZip,
}: BacktestDailyDataPanelProps) {
  if (run.equityPoints.length === 0) {
    return (
      <div data-testid="daily-data-panel">
        <p style={messageStyle}>日次データがありません</p>
      </div>
    );
  }

  const byDate = priceByDate(prices);
  const groupCols = scoreGroupColumns();
  const indicatorCols = scoreIndicatorColumns();
  const strategyLabel = formatStrategyLabel(run.strategyType, run.params);
  const period = `${run.fromDate}〜${run.toDate}`;

  return (
    <div data-testid="daily-data-panel" style={rootStyle}>
      <div style={headerRowStyle}>
        <h2 style={titleStyle}>日次データ</h2>
        {onDownloadZip ? (
          <button
            type="button"
            style={buttonStyle}
            data-testid="download-backtest-zip"
            onClick={onDownloadZip}
          >
            日次データ ZIP
          </button>
        ) : null}
      </div>

      <section aria-label="実行サマリー" style={summarySectionStyle}>
        <dl style={dlStyle}>
          <div style={dlRowStyle}>
            <dt style={dtStyle}>銘柄</dt>
            <dd style={ddStyle} data-testid="daily-symbol">
              {symbolLabel ?? ''}
            </dd>
          </div>
          <div style={dlRowStyle}>
            <dt style={dtStyle}>期間</dt>
            <dd style={ddStyle} data-testid="daily-period">
              {period}
            </dd>
          </div>
          <div style={dlRowStyle}>
            <dt style={dtStyle}>戦略</dt>
            <dd style={ddStyle} data-testid="daily-strategy">
              {strategyLabel}
            </dd>
          </div>
          <div style={dlRowStyle}>
            <dt style={dtStyle}>指標セット</dt>
            <dd style={ddStyle} data-testid="daily-indicator-set">
              {indicatorSetName ?? ''}
            </dd>
          </div>
          <div style={dlRowStyle}>
            <dt style={dtStyle}>初期資金</dt>
            <dd style={ddStyle} data-testid="daily-initial-cash">
              {cashLabel(run.initialCash)}
            </dd>
          </div>
          <div style={dlRowStyle}>
            <dt style={dtStyle}>手数料率</dt>
            <dd style={ddStyle}>{pctRate(run.feeRate)}</dd>
          </div>
          <div style={dlRowStyle}>
            <dt style={dtStyle}>スリッページ率</dt>
            <dd style={ddStyle}>{pctRate(run.slippageRate)}</dd>
          </div>
        </dl>
        <BacktestSummaryCards summary={run.summary} />
      </section>

      <section>
        <h3 style={sectionTitleStyle}>明細一覧</h3>
        <div style={wrapStyle}>
          <table data-testid="daily-detail-table" style={wideTableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>日付</th>
                <th style={thStyle}>現金</th>
                <th style={thStyle}>ポジション評価</th>
                <th style={thStyle}>資産</th>
                <th style={thStyle}>DD率</th>
                <th style={thStyle}>始値</th>
                <th style={thStyle}>高値</th>
                <th style={thStyle}>安値</th>
                <th style={thStyle}>終値</th>
                <th style={thStyle}>出来高</th>
                <th style={thStyle}>保有</th>
                <th style={thStyle}>売買</th>
                <th style={thStyle}>判断スコア</th>
                {groupCols.map((col) => (
                  <th key={`group-${col.id}`} style={thStyle}>
                    {col.label}
                  </th>
                ))}
                {indicatorCols.map((col) => (
                  <th key={`ind-${col.id}`} style={thStyle}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {run.equityPoints.map((point) => {
                const price = byDate.get(point.date);
                const breakdown = point.scoreBreakdown;
                return (
                  <tr key={point.id}>
                    <td style={tdStyle}>{point.date}</td>
                    <td style={tdStyle}>{numCell(point.cash)}</td>
                    <td style={tdStyle}>{numCell(point.positionValue)}</td>
                    <td style={tdStyle}>{numCell(point.equity)}</td>
                    <td style={tdStyle}>{pctRate(point.drawdownRate)}</td>
                    <td style={tdStyle}>{numCell(price?.open)}</td>
                    <td style={tdStyle}>{numCell(price?.high)}</td>
                    <td style={tdStyle}>{numCell(price?.low)}</td>
                    <td style={tdStyle}>{numCell(price?.close)}</td>
                    <td style={tdStyle}>
                      {price?.volume != null && Number.isFinite(price.volume)
                        ? String(price.volume)
                        : ''}
                    </td>
                    <td style={tdStyle}>{point.positionValue > 0 ? '1' : '0'}</td>
                    <td style={tdStyle}>{tradeEventForDate(point.date, run.trades)}</td>
                    <td style={tdStyle}>{formatScoreCell(point.decisionScore)}</td>
                    {groupCols.map((col): ReactNode => (
                      <td key={`g-${col.id}-${point.id}`} style={tdStyle}>
                        {formatGroupCell(breakdown, col.id)}
                      </td>
                    ))}
                    {indicatorCols.map((col): ReactNode => (
                      <td key={`i-${col.id}-${point.id}`} style={tdStyle}>
                        {formatIndicatorCell(breakdown, col.id)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};
const headerRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.75rem',
  justifyContent: 'space-between',
};
const titleStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 600,
  margin: 0,
};
const sectionTitleStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  margin: '0 0 0.5rem',
};
const summarySectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};
const messageStyle: CSSProperties = { margin: '0.5rem 0', opacity: 0.85 };
const dlStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))',
  gap: '0.5rem 1rem',
  margin: 0,
};
const dlRowStyle: CSSProperties = { margin: 0 };
const dtStyle: CSSProperties = {
  fontSize: '0.8rem',
  opacity: 0.75,
  marginBottom: '0.15rem',
};
const ddStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.95rem',
};
const wrapStyle: CSSProperties = { overflowX: 'auto' };
const wideTableStyle: CSSProperties = {
  width: 'max-content',
  minWidth: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
};
const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.35rem 0.45rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.35)',
  opacity: 0.85,
  whiteSpace: 'nowrap',
};
const tdStyle: CSSProperties = {
  padding: '0.35rem 0.45rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.15)',
  whiteSpace: 'nowrap',
};
const buttonStyle: CSSProperties = {
  padding: '0.6rem 1rem',
  border: '1px solid rgba(232, 238, 245, 0.55)',
  background: 'transparent',
  color: '#e8eef5',
  font: 'inherit',
  cursor: 'pointer',
};