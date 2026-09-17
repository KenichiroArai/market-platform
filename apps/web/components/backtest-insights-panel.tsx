/**
 * バックテスト結果の「結果の読み取り」パネル（ADR 019）。
 *
 * ルールベース・インサイトと次アクションボタンを表示する。
 */
'use client';

import type { CSSProperties } from 'react';
import type { BacktestInsight, BacktestInsightAction } from '@market/shared-types';

export type BacktestInsightsPanelProps = {
  insights: BacktestInsight[];
  onAction: (action: BacktestInsightAction) => void;
  /** プリセット適用後の短い説明（任意）。 */
  appliedNote?: string | null;
};

const severityLabel: Record<BacktestInsight['severity'], string> = {
  info: '参考',
  warn: '注意',
  critical: '要確認',
};

/** 結果サマリー直下に置く所見・次アクション一覧。 */
export function BacktestInsightsPanel({
  insights,
  onAction,
  appliedNote,
}: BacktestInsightsPanelProps) {
  return (
    <section
      data-testid="backtest-insights-panel"
      aria-label="結果の読み取り"
      style={wrapStyle}
    >
      <h2 style={titleStyle}>結果の読み取り</h2>
      <p style={leadStyle}>
        ルールベースの所見です。ボタンから再実行や戦略／チャートへ進めます。
      </p>
      {appliedNote ? (
        <p data-testid="insights-applied-note" style={noteStyle}>
          {appliedNote}
        </p>
      ) : null}
      <ul style={listStyle}>
        {insights.map((insight) => (
          <li
            key={insight.ruleId}
            data-testid={`insight-${insight.ruleId}`}
            style={itemStyle}
          >
            <div style={headerRowStyle}>
              <span style={badgeStyle(insight.severity)}>{severityLabel[insight.severity]}</span>
              <strong style={{ fontSize: '0.95rem' }}>{insight.summary}</strong>
            </div>
            {insight.evidence.length > 0 ? (
              <ul style={evidenceStyle}>
                {insight.evidence.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <div style={actionsRowStyle}>
              {insight.actions.map((action, index) => (
                <button
                  key={`${insight.ruleId}-${action.kind}-${index}`}
                  type="button"
                  data-testid={`insight-action-${insight.ruleId}-${action.kind}`}
                  onClick={() => onAction(action)}
                  style={actionButtonStyle}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const wrapStyle: CSSProperties = {
  marginTop: '1rem',
  maxWidth: '56rem',
  padding: '0.85rem 1rem',
  border: '1px solid rgba(232, 238, 245, 0.25)',
  background: 'rgba(0, 0, 0, 0.15)',
};

const titleStyle: CSSProperties = {
  margin: '0 0 0.35rem',
  fontSize: '0.95rem',
  fontWeight: 600,
};

const leadStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '0.85rem',
  opacity: 0.75,
  lineHeight: 1.5,
};

const noteStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  padding: '0.4rem 0.6rem',
  fontSize: '0.85rem',
  background: 'rgba(120, 180, 120, 0.15)',
  border: '1px solid rgba(120, 180, 120, 0.35)',
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: '0.85rem',
};

const itemStyle: CSSProperties = {
  margin: 0,
  paddingBottom: '0.75rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.12)',
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  alignItems: 'flex-start',
};

function badgeStyle(severity: BacktestInsight['severity']): CSSProperties {
  const colors = {
    info: 'rgba(140, 170, 210, 0.35)',
    warn: 'rgba(210, 170, 90, 0.4)',
    critical: 'rgba(210, 110, 110, 0.45)',
  };
  return {
    fontSize: '0.7rem',
    padding: '0.15rem 0.4rem',
    background: colors[severity],
    flexShrink: 0,
  };
}

const evidenceStyle: CSSProperties = {
  margin: '0.4rem 0 0.5rem 1.1rem',
  padding: 0,
  fontSize: '0.8rem',
  opacity: 0.8,
  lineHeight: 1.5,
};

const actionsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.4rem',
};

const actionButtonStyle: CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.35rem 0.65rem',
  cursor: 'pointer',
  background: 'rgba(232, 238, 245, 0.08)',
  border: '1px solid rgba(232, 238, 245, 0.35)',
  color: '#e8eef5',
};
