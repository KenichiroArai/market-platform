/**
 * 分析ワークフローバー（チャート／戦略／バックテスト共通）。
 *
 * 分析ハブへコンテキスト付きで戻り、次ステップへ進める細い導線。
 */
'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  analysisHref,
  backtestsHref,
  chartsHref,
  strategyHref,
  type AnalysisWorkflowContext,
} from '../lib/app-routes';

export type AnalysisWorkflowStep = 'charts' | 'strategy' | 'backtests';

export type AnalysisWorkflowBarProps = {
  current: AnalysisWorkflowStep;
  context: AnalysisWorkflowContext;
};

const STEP_LABELS: Record<AnalysisWorkflowStep, string> = {
  charts: 'チャート',
  strategy: '戦略',
  backtests: 'バックテスト',
};

/** 現在ステップ・分析に戻る・次へ／隣接ステップへのリンクを表示する。 */
export function AnalysisWorkflowBar({ current, context }: AnalysisWorkflowBarProps) {
  const hubHref = analysisHref({
    symbolId: context.symbolId,
    from: context.from,
    to: context.to,
    indicatorSetId: context.indicatorSetId,
  });

  const chartsLink = chartsHref({
    symbolId: context.symbolId,
    from: context.from,
    to: context.to,
  });

  const strategyLink = strategyHref({
    symbolId: context.symbolId,
    from: context.from,
    to: context.to,
    stopMethod: context.stopMethod,
    takeProfitMethod: context.takeProfitMethod,
    equity: context.equity,
    riskRate: context.riskRate,
  });

  const backtestsLink = backtestsHref({
    symbolId: context.symbolId,
    from: context.from,
    to: context.to,
    indicatorSetId: context.indicatorSetId,
    stopMethod: context.stopMethod,
    takeProfitMethod: context.takeProfitMethod,
    equity: context.equity,
    riskRate: context.riskRate,
  });

  return (
    <nav
      data-testid="analysis-workflow-bar"
      aria-label="分析ワークフロー"
      style={barStyle}
    >
      <div style={stepsStyle} aria-label="現在のステップ">
        {(['charts', 'strategy', 'backtests'] as const).map((step, index) => (
          <span key={step} style={stepItemStyle}>
            {index > 0 ? <span style={sepStyle} aria-hidden="true">→</span> : null}
            <span
              data-testid={`workflow-step-${step}`}
              style={step === current ? currentStepStyle : idleStepStyle}
              aria-current={step === current ? 'step' : undefined}
            >
              {STEP_LABELS[step]}
            </span>
          </span>
        ))}
      </div>
      <div style={linksStyle}>
        <Link href={hubHref} data-testid="workflow-back-to-analysis" style={linkStyle}>
          分析に戻る
        </Link>
        {current === 'charts' ? (
          <Link href={strategyLink} data-testid="workflow-next-strategy" style={linkStyle}>
            次へ: 戦略
          </Link>
        ) : null}
        {current === 'strategy' ? (
          <>
            <Link href={chartsLink} data-testid="workflow-to-charts" style={linkStyle}>
              チャート
            </Link>
            <Link href={backtestsLink} data-testid="workflow-next-backtests" style={linkStyle}>
              次へ: バックテスト
            </Link>
          </>
        ) : null}
        {current === 'backtests' ? (
          <>
            <Link href={chartsLink} data-testid="workflow-to-charts" style={linkStyle}>
              チャート
            </Link>
            <Link href={strategyLink} data-testid="workflow-to-strategy" style={linkStyle}>
              戦略
            </Link>
          </>
        ) : null}
      </div>
    </nav>
  );
}

const barStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem 1.25rem',
  marginBottom: '1rem',
  padding: '0.75rem 0.9rem',
  border: '1px solid rgba(232, 238, 245, 0.25)',
  background: 'rgba(0, 0, 0, 0.15)',
  fontSize: '0.9rem',
};

const stepsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.25rem',
  opacity: 0.9,
};

const stepItemStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
};

const sepStyle: CSSProperties = {
  opacity: 0.45,
  margin: '0 0.15rem',
};

const currentStepStyle: CSSProperties = {
  fontWeight: 700,
  textDecoration: 'underline',
  textUnderlineOffset: '0.2em',
};

const idleStepStyle: CSSProperties = {
  opacity: 0.65,
};

const linksStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem 1rem',
};

const linkStyle: CSSProperties = {
  color: '#e8eef5',
  textDecoration: 'underline',
};
