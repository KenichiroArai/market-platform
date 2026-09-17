/**
 * バックテスト結果からルールベースのインサイトを導出する（ADR 019）。
 *
 * 入力は永続済み Run DTO のみ。API は呼ばない。所見は都度計算。
 */
import type {
  BacktestInsight,
  BacktestInsightsResult,
  BacktestRunDto,
  BacktestRunPresetPatch,
} from '@market/shared-types';

/** 取引数がこれ未満なら「極端に少ない」。 */
const FEW_TRADES_MAX = 2;

/** force_close_end がこの比率以上なら期間末決済偏重。 */
const FORCE_CLOSE_RATIO = 0.4;

/** 損切系 exit がこの比率以上かつ勝率が低い。 */
const STOP_HEAVY_RATIO = 0.45;

/** 勝率がこれ未満なら「低い」。 */
const LOW_WIN_RATE = 0.4;

/** 戦略リターンが B&H をこの差以上下回る。 */
const UNDER_BUYHOLD_GAP = 0.05;

/** 最大 DD がこれ以上なら高い。 */
const HIGH_DRAWDOWN = 0.2;

/** 勝率がこれ以上かつ PF がこれ未満。 */
const HIGH_WR = 0.55;
const LOW_PF = 1.1;

/** 損切系とみなす exitReason 接尾・部分一致。 */
const STOP_EXIT_HINTS = [
  'stop_loss',
  'atr_stop',
  'stop',
] as const;

function countExitReasons(run: BacktestRunDto): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const trade of run.trades) {
    const key = trade.exitReason ?? 'unknown';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function isStopExitReason(reason: string | null): boolean {
  if (!reason) {
    return false;
  }
  const lower = reason.toLowerCase();
  return STOP_EXIT_HINTS.some((hint) => lower.includes(hint));
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function hrefHintFromRun(run: BacktestRunDto) {
  return {
    symbolId: run.symbolId,
    from: run.fromDate,
    to: run.toDate,
    stopMethod: run.exitPolicy?.stopMethod ?? null,
    takeProfitMethod: run.exitPolicy?.takeProfitMethod ?? null,
    equity: run.initialCash,
    riskRate: run.moneyManagement?.riskRate,
  };
}

function strategyAction(run: BacktestRunDto, label = '戦略で見直す') {
  return {
    kind: 'open_strategy' as const,
    label,
    hrefHint: hrefHintFromRun(run),
  };
}

function chartsAction(run: BacktestRunDto) {
  return {
    kind: 'open_charts' as const,
    label: 'チャートで確認',
    hrefHint: hrefHintFromRun(run),
  };
}

function presetAction(label: string, preset: BacktestRunPresetPatch) {
  return {
    kind: 'apply_run_preset' as const,
    label,
    preset,
  };
}

/**
 * Run からインサイト一覧を返す。
 * 特記が無い場合は `ok_baseline` を 1 件だけ含める。
 */
export function deriveBacktestInsights(run: BacktestRunDto): BacktestInsightsResult {
  const insights: BacktestInsight[] = [];
  const total = run.summary.totalTrades;
  const exitCounts = countExitReasons(run);
  const forceClose = exitCounts.force_close_end ?? 0;
  const stopExits = run.trades.filter((t) => isStopExitReason(t.exitReason)).length;
  const forceRatio = total > 0 ? forceClose / total : 0;
  const stopRatio = total > 0 ? stopExits / total : 0;
  const { winRate, maxDrawdownRate, totalReturnRate, buyHoldReturnRate, profitFactor } =
    run.summary;

  if (total <= FEW_TRADES_MAX) {
    insights.push({
      ruleId: 'few_trades',
      summary: `取引数が ${total} 件と少ないです。シグナル条件が厳しすぎる可能性があります。`,
      evidence: [`取引数: ${total}`],
      severity: 'warn',
      actions: [
        presetAction('買い閾値を下げて再実行', {
          buyThreshold: 25,
          sellThreshold: -25,
        }),
        strategyAction(run),
        chartsAction(run),
      ],
    });
  }

  if (total > 0 && forceRatio >= FORCE_CLOSE_RATIO) {
    insights.push({
      ruleId: 'force_close_heavy',
      summary: `期間末の強制決済が取引の ${pct(forceRatio)} を占めています。利確ルールが無い／弱い可能性があります。`,
      evidence: [
        `force_close_end: ${forceClose}/${total}`,
        `利確方式: ${run.exitPolicy?.takeProfitMethod ?? '未設定'}`,
      ],
      severity: 'warn',
      actions: [
        presetAction('RR利確を有効にして再実行', {
          exitPolicy: {
            stopMethod: run.exitPolicy?.stopMethod ?? 'atr',
            takeProfitMethod: 'rr_target',
            rrMultiple: 2,
          },
        }),
        strategyAction(run, '戦略で利確方式を確認'),
      ],
    });
  }

  if (total > 0 && stopRatio >= STOP_HEAVY_RATIO && winRate < LOW_WIN_RATE) {
    insights.push({
      ruleId: 'stop_heavy_low_wr',
      summary: `損切決済が ${pct(stopRatio)} で勝率も ${pct(winRate)} と低めです。ストップが早すぎる可能性があります。`,
      evidence: [`損切系 exit: ${stopExits}/${total}`, `勝率: ${pct(winRate)}`],
      severity: 'critical',
      actions: [
        presetAction('ストップを ATR×2 にして再実行', {
          exitPolicy: {
            stopMethod: 'atr_x2',
            takeProfitMethod: run.exitPolicy?.takeProfitMethod ?? null,
          },
        }),
        strategyAction(run),
      ],
    });
  }

  if (totalReturnRate < buyHoldReturnRate - UNDER_BUYHOLD_GAP) {
    const gap = buyHoldReturnRate - totalReturnRate;
    insights.push({
      ruleId: 'under_buyhold',
      summary: `戦略リターンが Buy & Hold を ${pct(gap)} 下回っています。判定や閾値の見直しを検討してください。`,
      evidence: [
        `戦略: ${pct(totalReturnRate)}`,
        `Buy & Hold: ${pct(buyHoldReturnRate)}`,
      ],
      severity: 'warn',
      actions: [
        strategyAction(run, '戦略で判定を確認'),
        chartsAction(run),
        ...(run.strategyType === 'trendScoreThreshold'
          ? [
              presetAction('閾値を緩和して再実行', {
                buyThreshold: 25,
                sellThreshold: -25,
              }),
            ]
          : []),
      ],
    });
  }

  if (maxDrawdownRate >= HIGH_DRAWDOWN) {
    const currentRisk = run.moneyManagement?.riskRate ?? 0.01;
    const reducedRisk = Math.max(0.005, Number((currentRisk * 0.5).toFixed(4)));
    insights.push({
      ruleId: 'high_drawdown',
      summary: `最大ドローダウンが ${pct(maxDrawdownRate)} と高めです。リスク率の縮小を検討してください。`,
      evidence: [`最大DD: ${pct(maxDrawdownRate)}`, `現行リスク率: ${pct(currentRisk)}`],
      severity: 'critical',
      actions: [
        presetAction(`リスク率を ${pct(reducedRisk)} にして再実行`, {
          moneyManagementRiskRate: reducedRisk,
        }),
        strategyAction(run),
      ],
    });
  }

  if (winRate >= HIGH_WR && profitFactor < LOW_PF && total > FEW_TRADES_MAX) {
    insights.push({
      ruleId: 'high_wr_low_pf',
      summary: `勝率は ${pct(winRate)} と高い一方、Profit Factor は ${profitFactor.toFixed(2)} と伸びていません。利確を早めるかコストを確認してください。`,
      evidence: [`勝率: ${pct(winRate)}`, `PF: ${profitFactor.toFixed(2)}`],
      severity: 'info',
      actions: [
        presetAction('RR利確を 1.5 にして再実行', {
          exitPolicy: {
            stopMethod: run.exitPolicy?.stopMethod ?? 'atr',
            takeProfitMethod: 'rr_target',
            rrMultiple: 1.5,
          },
        }),
        chartsAction(run),
      ],
    });
  }

  if (insights.length === 0) {
    insights.push({
      ruleId: 'ok_baseline',
      summary: '特記すべき偏りは見当たりません。同条件のトレードプランを戦略画面で確認できます。',
      evidence: [
        `リターン: ${pct(totalReturnRate)}`,
        `勝率: ${pct(winRate)}`,
        `最大DD: ${pct(maxDrawdownRate)}`,
      ],
      severity: 'info',
      actions: [strategyAction(run), chartsAction(run)],
    });
  }

  const order = { critical: 0, warn: 1, info: 2 } as const;
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  return { insights };
}
