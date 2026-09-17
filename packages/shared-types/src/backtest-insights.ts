/**
 * バックテスト結果インサイト（ADR 019 / v0.5.0 Phase 3）。
 *
 * Run DTO から都度導出する所見・次アクションの契約。永続化しない。
 */

/** ルール ID（安定コード。UI・テストで参照）。 */
export type BacktestInsightRuleId =
  | 'few_trades'
  | 'force_close_heavy'
  | 'stop_heavy_low_wr'
  | 'under_buyhold'
  | 'high_drawdown'
  | 'high_wr_low_pf'
  | 'ok_baseline';

/** 再実行フォームに適用する差分。未指定フィールドは現状維持。 */
export interface BacktestRunPresetPatch {
  buyThreshold?: number;
  sellThreshold?: number;
  exitPolicy?: {
    stopMethod?: string | null;
    takeProfitMethod?: string | null;
    atrTargetMultiple?: number;
    rrMultiple?: number;
  } | null;
  moneyManagementRiskRate?: number;
}

/** 次アクションの種別。 */
export type BacktestInsightActionKind =
  | 'apply_run_preset'
  | 'open_strategy'
  | 'open_charts';

/** 1 件の次アクション。 */
export interface BacktestInsightAction {
  kind: BacktestInsightActionKind;
  /** ボタン表示ラベル。 */
  label: string;
  /** apply_run_preset 時のフォーム差分。 */
  preset?: BacktestRunPresetPatch;
  /** open_strategy / open_charts 用のクエリヒント。 */
  hrefHint?: {
    symbolId?: string;
    from?: string;
    to?: string;
    stopMethod?: string | null;
    takeProfitMethod?: string | null;
    equity?: number;
    riskRate?: number;
  };
}

/** 1 件のインサイト（所見）。 */
export interface BacktestInsight {
  ruleId: BacktestInsightRuleId;
  /** ユーザー向け短文。 */
  summary: string;
  /** 根拠メトリクスの短い説明（UI 表示用）。 */
  evidence: string[];
  /** 重大度。高いものほど先に並べる。 */
  severity: 'info' | 'warn' | 'critical';
  actions: BacktestInsightAction[];
}

/** インサイト導出結果。 */
export interface BacktestInsightsResult {
  insights: BacktestInsight[];
}
