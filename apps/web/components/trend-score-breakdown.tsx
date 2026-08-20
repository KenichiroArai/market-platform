/**
 * トレンドスコアのグループ／個別内訳（ADR 007 / Ph6）。
 *
 * 基準日の TrendScorePoint を、総合スコアの横棒ゲージ・グループ寄与・指標点数で表示する。
 * 採点計算は API 側済み。ここは表示のみ。
 */
'use client';

import type { CSSProperties } from 'react';
import {
  INDICATOR_CATEGORIES,
  TREND_SCORE_GROUP_WEIGHTS,
  TREND_SCORE_GAUGE_MAX,
  TREND_SCORE_GAUGE_MIN,
  definitionsForScoreGroup,
  scoreToGaugePercent,
  trendScoreGaugeExplanation,
  trendScoreGaugeSegments,
  trendScoreState,
  type TrendScorePoint,
} from '@market/shared-types';
import { TREND_SCORE_GAUGE_COLORS } from '../lib/trend-score-gauge-colors';

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
  const segments = trendScoreGaugeSegments();
  const gaugeSpan = TREND_SCORE_GAUGE_MAX - TREND_SCORE_GAUGE_MIN;
  const markerPct = point.score === null ? null : scoreToGaugePercent(point.score);

  return (
    <div data-testid="trend-score-breakdown" style={rootStyle}>
      <p style={summaryStyle} data-testid="trend-score-breakdown-summary">
        基準日 {point.date}
        <br />
        総合 {formatScoreValue(point.score)}
        {point.score !== null ? `（${state.labelJa}）` : ''}
      </p>

      <section data-testid="trend-score-gauge" style={gaugeSectionStyle} aria-label="総合スコアの区分">
        <div style={gaugeTrackStyle}>
          {segments.map((segment) => {
            const widthPct = ((segment.to - segment.from) / gaugeSpan) * 100;
            return (
              <div
                key={segment.id}
                data-testid={`trend-score-gauge-segment-${segment.id}`}
                title={`${segment.labelJa}（${segment.from}〜${segment.to}）`}
                style={{
                  ...gaugeSegmentStyle,
                  width: `${widthPct}%`,
                  background: TREND_SCORE_GAUGE_COLORS[segment.id],
                }}
              />
            );
          })}
          {markerPct !== null ? (
            <div
              data-testid="trend-score-gauge-marker"
              style={{
                ...gaugeMarkerStyle,
                left: `${markerPct}%`,
              }}
              aria-hidden
            />
          ) : null}
        </div>
        <div style={gaugeScaleStyle} aria-hidden>
          <span>{TREND_SCORE_GAUGE_MIN}</span>
          <span>0</span>
          <span>+{TREND_SCORE_GAUGE_MAX}</span>
        </div>
        <p data-testid="trend-score-gauge-explanation" style={explanationStyle}>
          {trendScoreGaugeExplanation(point.score)}
        </p>
      </section>

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

const gaugeSectionStyle: CSSProperties = {
  margin: 0,
};

const gaugeTrackStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  width: '100%',
  height: 22,
  borderRadius: 3,
  overflow: 'hidden',
  border: '1px solid rgba(232, 238, 245, 0.35)',
};

const gaugeSegmentStyle: CSSProperties = {
  height: '100%',
  flexShrink: 0,
};

const gaugeMarkerStyle: CSSProperties = {
  position: 'absolute',
  top: -2,
  bottom: -2,
  width: 2,
  marginLeft: -1,
  background: '#111111',
  boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.85)',
  pointerEvents: 'none',
};

const gaugeScaleStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '0.25rem',
  fontSize: '0.75rem',
  opacity: 0.75,
};

const explanationStyle: CSSProperties = {
  margin: '0.45rem 0 0',
  lineHeight: 1.45,
  fontSize: '0.88rem',
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
