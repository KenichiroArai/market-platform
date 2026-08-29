/**
 * バックテスト資金管理（マネーマネージメント）の共有契約（ADR 016）。
 *
 * Analysis / Nest / Web が同一 JSON 形でやりとりする。
 */

/** 売買方針。longOnly = 現行互換、longShort = 空売りあり。 */
export type TradeSidePolicy = 'longOnly' | 'longShort';

/** 手数料の計算方式。 */
export type FeeMode = 'rate' | 'fixed';

/** ATR 系ボラティリティの種類。 */
export type AtrKind = 'atr' | 'n';

/** 相関グループ（Run スナップショット内。単一銘柄 BT では所属グループ上限を適用）。 */
export interface CorrelationGroupConfig {
  /** 表示名（例: 貴金属） */
  name: string;
  /** グループに含める銘柄 ID */
  symbolIds: string[];
  /** グループ内の最大ユニット数 */
  maxUnits: number;
  /** グループ内の最大リスク率（0–1。例: 0.04 = 4%） */
  maxRisk: number;
}

/**
 * タートルズ系資金管理設定。
 * enabled=false のときはサイジング／ストップ／ピラミッド等を使わない（全額投資パス）。
 */
export interface MoneyManagementConfig {
  /** マスタースイッチ。false / 省略時は従来バックテスト。 */
  enabled: boolean;
  /** 1 トレードあたりのリスク率（例: 0.01 = 1%）。ドローダウン縮小前の基準値。 */
  riskRate: number;
  /** ATR / N の期間（デフォルト 20） */
  atrPeriod: number;
  /** ATR またはタートルズ N */
  atrKind: AtrKind;
  /** ストップ幅 = ATR × この倍率（デフォルト 2） */
  stopMultiple: number;
  /** 最小取引数量（丸め後） */
  minQuantity: number;
  /** 最大取引数量（丸め後）。null なら上限なし */
  maxQuantity: number | null;
  /** true なら小数数量可、false なら切り捨て整数 */
  allowFractionalQuantity: boolean;
  /** ピラミッディング */
  pyramiding: {
    enabled: boolean;
    /** 追加間隔（ATR 倍率。デフォルト 0.5） */
    stepAtrMultiple: number;
    /** 最大ユニット数（デフォルト 4） */
    maxUnits: number;
  };
  /** ドローダウン管理 */
  drawdown: {
    enabled: boolean;
    /** Equity High からの下落率閾値（例: 0.10 = 10%） */
    thresholdRate: number;
    /** 閾値到達ごとにリスクを掛ける縮小率（例: 0.20 → 残り 80%） */
    riskReductionRate: number;
  };
  /** 相関管理（単一銘柄向けキャップ） */
  correlation: {
    enabled: boolean;
    groups: CorrelationGroupConfig[];
  };
}

/** バックテスト実行時に返す資金管理まわりの集計。 */
export interface MoneyManagementStats {
  averageRiskRate: number | null;
  maxRiskRate: number | null;
  averageAtr: number | null;
  averageUnits: number | null;
  maxUnits: number | null;
  /** 追加エントリー後に最終的に利益だったラウンドの割合（0–1）。該当なしは null */
  pyramidingSuccessRate: number | null;
  /** ドローダウン縮小が効いている期間の平均実効リスク率 */
  averageRiskRateInDrawdown: number | null;
}

/** デフォルトの資金管理設定（UI・未指定時の基準）。 */
export const DEFAULT_MONEY_MANAGEMENT: MoneyManagementConfig = {
  enabled: false,
  riskRate: 0.01,
  atrPeriod: 20,
  atrKind: 'n',
  stopMultiple: 2,
  minQuantity: 0,
  maxQuantity: null,
  allowFractionalQuantity: true,
  pyramiding: {
    enabled: true,
    stepAtrMultiple: 0.5,
    maxUnits: 4,
  },
  drawdown: {
    enabled: true,
    thresholdRate: 0.1,
    riskReductionRate: 0.2,
  },
  correlation: {
    enabled: false,
    groups: [],
  },
};

export function isTradeSidePolicy(value: unknown): value is TradeSidePolicy {
  return value === 'longOnly' || value === 'longShort';
}

export function isFeeMode(value: unknown): value is FeeMode {
  return value === 'rate' || value === 'fixed';
}

export function isAtrKind(value: unknown): value is AtrKind {
  return value === 'atr' || value === 'n';
}

function isCorrelationGroupConfig(value: unknown): value is CorrelationGroupConfig {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.name === 'string' &&
    Array.isArray(row.symbolIds) &&
    row.symbolIds.every((id) => typeof id === 'string') &&
    typeof row.maxUnits === 'number' &&
    typeof row.maxRisk === 'number'
  );
}

export function isMoneyManagementConfig(value: unknown): value is MoneyManagementConfig {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  if (typeof r.enabled !== 'boolean') {
    return false;
  }
  if (typeof r.riskRate !== 'number' || typeof r.atrPeriod !== 'number') {
    return false;
  }
  if (!isAtrKind(r.atrKind) || typeof r.stopMultiple !== 'number') {
    return false;
  }
  if (typeof r.minQuantity !== 'number') {
    return false;
  }
  if (!(r.maxQuantity === null || typeof r.maxQuantity === 'number')) {
    return false;
  }
  if (typeof r.allowFractionalQuantity !== 'boolean') {
    return false;
  }
  const pyr = r.pyramiding;
  if (pyr === null || typeof pyr !== 'object') {
    return false;
  }
  const p = pyr as Record<string, unknown>;
  if (
    typeof p.enabled !== 'boolean' ||
    typeof p.stepAtrMultiple !== 'number' ||
    typeof p.maxUnits !== 'number'
  ) {
    return false;
  }
  const dd = r.drawdown;
  if (dd === null || typeof dd !== 'object') {
    return false;
  }
  const d = dd as Record<string, unknown>;
  if (
    typeof d.enabled !== 'boolean' ||
    typeof d.thresholdRate !== 'number' ||
    typeof d.riskReductionRate !== 'number'
  ) {
    return false;
  }
  const corr = r.correlation;
  if (corr === null || typeof corr !== 'object') {
    return false;
  }
  const c = corr as Record<string, unknown>;
  if (typeof c.enabled !== 'boolean' || !Array.isArray(c.groups)) {
    return false;
  }
  return c.groups.every(isCorrelationGroupConfig);
}

export function isMoneyManagementStats(value: unknown): value is MoneyManagementStats {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const r = value as Record<string, unknown>;
  const optNum = (v: unknown) => v === null || typeof v === 'number';
  return (
    optNum(r.averageRiskRate) &&
    optNum(r.maxRiskRate) &&
    optNum(r.averageAtr) &&
    optNum(r.averageUnits) &&
    optNum(r.maxUnits) &&
    optNum(r.pyramidingSuccessRate) &&
    optNum(r.averageRiskRateInDrawdown)
  );
}

/** 売買方針の表示ラベル。 */
export function formatTradeSidePolicyLabel(policy: TradeSidePolicy): string {
  return policy === 'longShort' ? '売買（ショートあり）' : 'ロングのみ';
}

/** 手数料モードの表示ラベル。 */
export function formatFeeModeLabel(mode: FeeMode): string {
  return mode === 'fixed' ? '固定額' : '率（%）';
}
