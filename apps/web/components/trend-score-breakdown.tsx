/**
 * トレンドスコアのグループ／個別内訳（ADR 007 / Ph6）。
 *
 * 基準日の TrendScorePoint を、scoreGroup ごとの寄与と指標点数で表示する。
 * 採点計算は API 側済み。ここは表示のみ。
 */
'use client';

import type { CSSProperties } from 'react';
import {
  INDICATOR_CATEGORIES,
  TREND_SCORE_GROUP_WEIGHTS,
  definitionsForScoreGroup,
  trendScoreState,
  type TrendScorePoint,
} from '@market/shared-types';

export type TrendScoreBreakdownProps = {
  point: TrendScorePoint | null;
};

/** 点数を表示用文字列にする（null は未算出）。 */
export function formatScoreValue(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return String(Math.round(value));
}

/** グループ／個別のスコア内訳パネル。 */
export function TrendScoreBreakdown({ point }: TrendScoreBreakdownProps) {
  if (point === null) {
    return (
      <p data-testid="trend-score-breakdown-empty" style={emptyStyle}>
        表示できるスコアがありません
      </p>
    );
  }

  const state = trendScoreState(point.score);

  return (
    <div data-testid="trend-score-breakdown" style={rootStyle}>
      <p style={summaryStyle} data-testid="trend-score-breakdown-summary">
        基準日 {point.date}
        <br />
        総合 {formatScoreValue(point.score)}
        {point.score !== null ? `（${state.labelJa}）` : ''}
      </p>

      {INDICATOR_CATEGORIES.map((category) => {
        const groupScore = point.groups[category.id];
        const weight = TREND_SCORE_GROUP_WEIGHTS[category.id];
        const indicators = definitionsForScoreGroup(category.id);
        return (
          <section
            key={category.id}
            data-testid={`trend-score-group-${category.id}`}
            style={groupStyle}
          >
            <h3 style={groupTitleStyle}>
              {category.nameJa}（配点 ±{weight}）: {formatScoreValue(groupScore)}
            </h3>
            <ul style={listStyle}>
              {indicators.map((def) => (
                <li key={def.id} data-testid={`trend-score-indicator-${def.id}`}>
                  {def.nameJa}: {formatScoreValue(point.indicators[def.id] ?? null)}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  fontSize: '0.9rem',
};

const emptyStyle: CSSProperties = {
  margin: 0,
  opacity: 0.85,
};

const summaryStyle: CSSProperties = {
  margin: 0,
  lineHeight: 1.45,
};

const groupStyle: CSSProperties = {
  margin: 0,
};

const groupTitleStyle: CSSProperties = {
  margin: '0 0 0.35rem',
  fontSize: '0.95rem',
  fontWeight: 600,
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.15rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
};
