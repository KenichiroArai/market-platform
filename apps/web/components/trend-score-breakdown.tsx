/**
 * トレンドスコアのグループ／個別内訳（ADR 007 / Ph6）。
 *
 * 基準日の TrendScorePoint を、総合スコアの横棒ゲージと内訳テーブルで表示する。
 * 採点計算は API 側済み。ここは表示と、寄与の比率（貢献度）の算出のみ。
 *
 * 貢献度:
 * - 指標の総合への寄与点 = (score / 100) * (groupWeight / 有効本数)
 *   （グループ平均を配点へスケールする式の展開）
 * - 比率は |寄与| 合計を分母にした符号付きシェア（反対方向も含めて説明できる）
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
  type IndicatorCategoryId,
  type TrendScorePoint,
} from '@market/shared-types';
import { TREND_SCORE_GAUGE_COLORS } from '../lib/trend-score-gauge-colors';

export type TrendScoreBreakdownProps = {
  point: TrendScorePoint | null;
  /** カスタムグループ配点。省略時は ADR 007 既定。 */
  groupWeights?: Record<IndicatorCategoryId, number>;
};

/** 点数を表示用文字列にする（null は未算出）。 */
export function formatScoreValue(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return String(Math.round(value));
}

/**
 * 指標 1 本の総合スコアへの寄与点。
 * groupContrib = (avg / 100) * weight、avg = sum(scores) / n なので展開するとこの式になる。
 */
export function indicatorContributionPoints(
  score: number,
  groupWeight: number,
  validCountInGroup: number,
): number {
  return (score * groupWeight) / (100 * validCountInGroup);
}

/**
 * 寄与の符号付きシェア（|parts| の合計を 1 とする）。
 * 分母が 0、または part が null のときは null。
 */
export function signedContributionShare(
  part: number | null,
  parts: ReadonlyArray<number | null>,
): number | null {
  if (part === null) {
    return null;
  }
  let denom = 0;
  for (const entry of parts) {
    if (entry !== null) {
      denom += Math.abs(entry);
    }
  }
  if (denom === 0) {
    return null;
  }
  return part / denom;
}

/** 貢献度比率を +12.3% / -4.0% / — の形にする。 */
export function formatContributionRatio(share: number | null): string {
  if (share === null) {
    return '—';
  }
  const pct = Math.round(share * 1000) / 10;
  if (pct === 0) {
    return '0.0%';
  }
  const abs = Math.abs(pct).toFixed(1);
  return pct > 0 ? `+${abs}%` : `-${abs}%`;
}

type GroupTableBlock = {
  categoryId: IndicatorCategoryId;
  categoryNameJa: string;
  weight: number;
  groupScore: number | null;
  groupOverallShare: number | null;
  indicators: {
    id: string;
    nameJa: string;
    score: number | null;
    withinGroupShare: number | null;
    overallShare: number | null;
  }[];
};

/** 表示用にグループ／指標の寄与と比率を組み立てる。 */
export function buildBreakdownTable(
  point: TrendScorePoint,
  weights: Record<IndicatorCategoryId, number> = TREND_SCORE_GROUP_WEIGHTS,
): GroupTableBlock[] {
  const groupParts: Array<number | null> = INDICATOR_CATEGORIES.map(
    (category) => point.groups[category.id],
  );

  const indicatorOverallParts: Array<number | null> = [];
  const perGroupValidScores: Record<IndicatorCategoryId, number[]> = {
    trend: [],
    momentum: [],
    oscillator: [],
    volatility: [],
    volume: [],
    cycle: [],
  };

  for (const category of INDICATOR_CATEGORIES) {
    const defs = definitionsForScoreGroup(category.id);
    for (const def of defs) {
      const score = point.indicators[def.id] ?? null;
      if (score !== null) {
        perGroupValidScores[category.id].push(score);
      }
    }
  }

  // 全体分母用に、全指標の寄与点を先に集める
  for (const category of INDICATOR_CATEGORIES) {
    const weight = weights[category.id];
    const valid = perGroupValidScores[category.id];
    const n = valid.length;
    const defs = definitionsForScoreGroup(category.id);
    for (const def of defs) {
      const score = point.indicators[def.id] ?? null;
      if (score === null || n === 0) {
        indicatorOverallParts.push(null);
      } else {
        indicatorOverallParts.push(indicatorContributionPoints(score, weight, n));
      }
    }
  }

  let overallPartIndex = 0;
  return INDICATOR_CATEGORIES.map((category) => {
    const weight = weights[category.id];
    const groupScore = point.groups[category.id];
    const valid = perGroupValidScores[category.id];
    const n = valid.length;
    const defs = definitionsForScoreGroup(category.id);

    const withinParts: Array<number | null> = defs.map((def) => {
      const score = point.indicators[def.id] ?? null;
      if (score === null || n === 0) {
        return null;
      }
      return indicatorContributionPoints(score, weight, n);
    });

    const indicators = defs.map((def, index) => {
      const score = point.indicators[def.id] ?? null;
      const overallPart = indicatorOverallParts[overallPartIndex] ?? null;
      overallPartIndex += 1;
      return {
        id: def.id,
        nameJa: def.nameJa,
        score,
        withinGroupShare: signedContributionShare(withinParts[index] ?? null, withinParts),
        overallShare: signedContributionShare(overallPart, indicatorOverallParts),
      };
    });

    return {
      categoryId: category.id,
      categoryNameJa: category.nameJa,
      weight,
      groupScore,
      groupOverallShare: signedContributionShare(groupScore, groupParts),
      indicators,
    };
  });
}

/** グループ／個別のスコア内訳パネル。 */
export function TrendScoreBreakdown({ point, groupWeights }: TrendScoreBreakdownProps) {
  const weights = groupWeights ?? TREND_SCORE_GROUP_WEIGHTS;
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
  const table = buildBreakdownTable(point, weights);

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

      <div style={tableWrapStyle}>
        <table data-testid="trend-score-breakdown-table" style={tableStyle}>
          <thead>
            <tr>
              <th scope="col" style={thStyle}>
                グループ / 指標
              </th>
              <th scope="col" style={{ ...thStyle, ...numericThStyle }}>
                点数
              </th>
              <th scope="col" style={{ ...thStyle, ...numericThStyle }}>
                グループ内貢献度
              </th>
              <th scope="col" style={{ ...thStyle, ...numericThStyle }}>
                全体貢献度
              </th>
            </tr>
          </thead>
          <tbody>
            {table.map((group) => (
              <GroupRows key={group.categoryId} group={group} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({ group }: { group: GroupTableBlock }) {
  return (
    <>
      <tr data-testid={`trend-score-group-${group.categoryId}`} style={groupRowStyle}>
        <th scope="rowgroup" style={groupLabelStyle}>
          {group.categoryNameJa}
          <span style={groupMetaStyle}>（配点 ±{group.weight}）</span>
        </th>
        <td style={{ ...tdStyle, ...numericTdStyle }}>{formatScoreValue(group.groupScore)}</td>
        <td style={{ ...tdStyle, ...numericTdStyle }}>—</td>
        <td
          style={{ ...tdStyle, ...numericTdStyle }}
          data-testid={`trend-score-group-overall-${group.categoryId}`}
        >
          {formatContributionRatio(group.groupOverallShare)}
        </td>
      </tr>
      {group.indicators.map((indicator) => (
        <tr key={indicator.id} data-testid={`trend-score-indicator-${indicator.id}`}>
          <td style={{ ...tdStyle, ...indicatorNameStyle }}>{indicator.nameJa}</td>
          <td style={{ ...tdStyle, ...numericTdStyle }}>{formatScoreValue(indicator.score)}</td>
          <td
            style={{ ...tdStyle, ...numericTdStyle }}
            data-testid={`trend-score-within-${indicator.id}`}
          >
            {formatContributionRatio(indicator.withinGroupShare)}
          </td>
          <td
            style={{ ...tdStyle, ...numericTdStyle }}
            data-testid={`trend-score-overall-${indicator.id}`}
          >
            {formatContributionRatio(indicator.overallShare)}
          </td>
        </tr>
      ))}
    </>
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

const tableWrapStyle: CSSProperties = {
  overflowX: 'auto',
  margin: 0,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.35)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const numericThStyle: CSSProperties = {
  textAlign: 'right',
};

const tdStyle: CSSProperties = {
  padding: '0.3rem 0.5rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.18)',
  verticalAlign: 'top',
};

const numericTdStyle: CSSProperties = {
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const groupRowStyle: CSSProperties = {
  background: 'rgba(232, 238, 245, 0.08)',
};

const groupLabelStyle: CSSProperties = {
  ...tdStyle,
  textAlign: 'left',
  fontWeight: 600,
};

const groupMetaStyle: CSSProperties = {
  fontWeight: 400,
  opacity: 0.85,
  marginLeft: '0.25rem',
};

const indicatorNameStyle: CSSProperties = {
  paddingLeft: '1.15rem',
};
