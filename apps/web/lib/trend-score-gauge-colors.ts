/**
 * 総合スコア横棒ゲージの状態色（ADR 007 / Ph6）。
 *
 * チャート背景より不透明にして、区分が一目で分かるようにする。
 */
import type { TrendScoreState } from '@market/shared-types';

export const TREND_SCORE_GAUGE_COLORS: Record<TrendScoreState['id'], string> = {
  strongUp: '#1b8a7e',
  upTrend: '#26a69a',
  rangeUp: '#7bc9c0',
  range: '#9aa5b1',
  rangeDown: '#e89a96',
  downTrend: '#ef5350',
  strongDown: '#c62828',
};
