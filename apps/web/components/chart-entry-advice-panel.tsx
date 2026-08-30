/**
 * チャート分析のエントリー助言パネル（ADR 017）。
 */
'use client';

import type { CSSProperties } from 'react';
import {
  formatDecisionScore,
  formatTradeReason,
  type EntryAdviceDto,
} from '@market/shared-types';
import { formatGroupCell, formatIndicatorCell, scoreGroupColumns, scoreIndicatorColumns } from '../lib/backtest-score-columns';
import { formatMarketPrice } from '../lib/format-market-price';

export type ChartEntryAdvicePanelProps = {
  advice: EntryAdviceDto | null;
  loading?: boolean;
  error?: string | null;
  currency?: string | null;
};

const timingLabels: Record<EntryAdviceDto['entryTiming'], string> = {
  in_position: '建玉あり',
  entry_now: 'エントリーシグナル',
  wait: '待機',
  no_rule: '判定不可',
};

export function ChartEntryAdvicePanel({
  advice,
  loading,
  error,
  currency = null,
}: ChartEntryAdvicePanelProps) {
  if (loading) {
    return <p style={mutedStyle} data-testid="entry-advice-loading">エントリー助言を読み込み中…</p>;
  }
  if (error) {
    return <p style={errorStyle} data-testid="entry-advice-error">{error}</p>;
  }
  if (!advice) {
    return null;
  }

  const reasonLabel = formatTradeReason(advice.entryReasonCode, advice.scoreAtBase);
  const groupCols = scoreGroupColumns();
  const indicatorCols = scoreIndicatorColumns().slice(0, 8);

  return (
    <section style={panelStyle} data-testid="entry-advice-panel">
      <h3 style={titleStyle}>エントリー助言（トレンドスコア）</h3>
      <p style={metaStyle} data-testid="entry-advice-timing">
        {timingLabels[advice.entryTiming]}（基準日: {advice.baseDate}）
      </p>
      <p style={metaStyle} data-testid="entry-advice-signal-label">{advice.signalLabel}</p>

      {advice.rationale ? (
        <p style={metaStyle} data-testid="entry-advice-rationale">{advice.rationale}</p>
      ) : null}
      {reasonLabel ? (
        <p style={metaStyle} data-testid="entry-advice-reason">{reasonLabel}</p>
      ) : null}

      {advice.scoreAtBase != null ? (
        <p style={metaStyle} data-testid="entry-advice-score">
          総合スコア: {formatDecisionScore(advice.scoreAtBase)}
          {advice.buyThreshold != null ? ` / 買い ≥${advice.buyThreshold}` : ''}
          {advice.sellThreshold != null ? ` / 売り ≤${advice.sellThreshold}` : ''}
        </p>
      ) : null}

      {advice.scoreBreakdown ? (
        <div style={blockStyle} data-testid="entry-advice-breakdown">
          <p style={subTitleStyle}>スコア内訳（基準日）</p>
          <p style={breakdownLineStyle}>
            グループ:{' '}
            {groupCols
              .map((col) => {
                const cell = formatGroupCell(advice.scoreBreakdown, col.id);
                return cell ? `${col.label} ${cell}` : '';
              })
              .filter(Boolean)
              .join(' / ')}
          </p>
          <p style={breakdownLineStyle}>
            指標:{' '}
            {indicatorCols
              .map((col) => {
                const cell = formatIndicatorCell(advice.scoreBreakdown, col.id);
                return cell ? `${col.label} ${cell}` : '';
              })
              .filter(Boolean)
              .join(' / ')}
          </p>
        </div>
      ) : null}

      {advice.entryTiming === 'no_rule' && advice.noRuleReason ? (
        <p style={mutedStyle}>{advice.noRuleReason}</p>
      ) : null}

      {advice.position ? (
        <div style={blockStyle}>
          <p>
            建玉: {advice.position.isLong ? 'ロング' : 'ショート'} / エントリー{' '}
            {advice.position.entryDate} @ {formatMarketPrice(advice.position.entryPrice, currency)}{' '}
            / ユニット {advice.position.units}
          </p>
        </div>
      ) : null}

      {advice.mm ? (
        <div style={blockStyle} data-testid="entry-advice-mm">
          <p>ATR: {formatNum(advice.mm.atr)} / リスク率: {formatPct(advice.mm.riskRate)}</p>
          <p>1ユニット数量: {formatNum(advice.mm.unitQuantity)}</p>
          <p>ストップ: {formatMarketPrice(advice.mm.stopPrice, currency)}</p>
        </div>
      ) : null}

      {advice.pyramidLevels && advice.pyramidLevels.length > 0 ? (
        <div style={blockStyle} data-testid="entry-advice-pyramid">
          <p style={subTitleStyle}>追加水準</p>
          <ul style={listStyle}>
            {advice.pyramidLevels.map((level) => (
              <li key={level.unitIndex}>
                U{level.unitIndex}: {formatMarketPrice(level.price, currency)}
                {level.reached ? '（到達済）' : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {advice.newEntryFromBase ? (
        <div style={blockStyle} data-testid="entry-advice-new-entry">
          <p style={subTitleStyle}>
            基準日で新規エントリーした場合（
            {advice.newEntryFromBase.isLong ? 'ロング' : 'ショート'} @{' '}
            {formatMarketPrice(advice.newEntryFromBase.entryPrice, currency)}）
          </p>
          {advice.newEntryFromBase.mm ? (
            <p>
              ストップ: {formatMarketPrice(advice.newEntryFromBase.mm.stopPrice, currency)} / 1U:{' '}
              {formatNum(advice.newEntryFromBase.mm.unitQuantity)}
            </p>
          ) : null}
          {advice.newEntryFromBase.pyramidLevels && advice.newEntryFromBase.pyramidLevels.length > 0 ? (
            <ul style={listStyle}>
              {advice.newEntryFromBase.pyramidLevels.map((level) => (
                <li key={level.unitIndex}>
                  追加 U{level.unitIndex}: {formatMarketPrice(level.price, currency)}
                  {level.reached ? '（到達済）' : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {advice.predictedEntry ? (
        <div style={blockStyle} data-testid="entry-advice-predicted">
          <p style={subTitleStyle}>予測エントリー（参考）</p>
          <p>{advice.predictedEntry.basis}</p>
          {advice.predictedEntry.triggerDate ? (
            <p>推定日: {advice.predictedEntry.triggerDate}</p>
          ) : null}
          {advice.predictedEntry.triggerPrice != null ? (
            <p>推定価格: {formatMarketPrice(advice.predictedEntry.triggerPrice, currency)}</p>
          ) : null}
          <p style={noteStyle}>{advice.predictedEntry.note}</p>
        </div>
      ) : null}
    </section>
  );
}

function formatNum(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  return `${(value * 100).toFixed(2)}%`;
}

const panelStyle: CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.75rem',
  border: '1px solid rgba(232, 238, 245, 0.12)',
  borderRadius: 8,
  background: 'rgba(18, 38, 58, 0.55)',
};

const titleStyle: CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1rem',
};

const subTitleStyle: CSSProperties = {
  margin: '0 0 0.35rem',
  fontWeight: 600,
};

const metaStyle: CSSProperties = {
  margin: '0.15rem 0',
  opacity: 0.9,
};

const breakdownLineStyle: CSSProperties = {
  margin: '0.2rem 0',
  fontSize: '0.88rem',
  opacity: 0.88,
};

const blockStyle: CSSProperties = {
  marginTop: '0.5rem',
};

const listStyle: CSSProperties = {
  margin: '0.25rem 0 0',
  paddingLeft: '1.25rem',
};

const mutedStyle: CSSProperties = {
  margin: '0.5rem 0',
  opacity: 0.8,
};

const errorStyle: CSSProperties = {
  margin: '0.5rem 0',
  color: '#ff8a80',
};

const noteStyle: CSSProperties = {
  margin: '0.35rem 0 0',
  fontSize: '0.85rem',
  opacity: 0.75,
};
