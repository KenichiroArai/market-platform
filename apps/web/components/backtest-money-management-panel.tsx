/**
 * バックテスト資金管理設定パネル（ModelessWindow・ADR 016）。
 *
 * 開始資金横のボタンから開き、タブで基本／コスト／ピラミッド／DD／相関を編集する。
 */
'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  DEFAULT_MONEY_MANAGEMENT,
  type FeeMode,
  type MoneyManagementConfig,
  type SymbolDto,
} from '@market/shared-types';
import { MM_HELP } from './backtest-money-management-help';
import { FieldHelpIcon } from './field-help-icon';
import { ModelessWindow } from './modeless-window';

export type BacktestCostSettings = {
  feeMode: FeeMode;
  feeRate: number;
  feeFixed: number;
  slippageRate: number;
};

export type BacktestMoneyManagementPanelProps = {
  moneyManagement: MoneyManagementConfig;
  cost: BacktestCostSettings;
  /** 固定手数料の通貨表示用（選択銘柄）。 */
  currency: string | null;
  symbols: SymbolDto[];
  onChangeMoneyManagement: (next: MoneyManagementConfig) => void;
  onChangeCost: (next: BacktestCostSettings) => void;
  onClose: () => void;
};

type TabId = 'basic' | 'cost' | 'pyramid' | 'drawdown' | 'correlation';

const TABS: { id: TabId; label: string }[] = [
  { id: 'basic', label: '基本' },
  { id: 'cost', label: 'コスト' },
  { id: 'pyramid', label: 'ピラミッド' },
  { id: 'drawdown', label: 'ドローダウン' },
  { id: 'correlation', label: '相関' },
];

function LabelWithHelp({
  text,
  help,
  helpId,
}: {
  text: string;
  help: string;
  helpId: string;
}) {
  return (
    <span style={labelRowStyle}>
      {text}
      <FieldHelpIcon text={help} ariaLabel={`${text}の説明`} testId={helpId} />
    </span>
  );
}

function CheckWithHelp({
  checked,
  disabled,
  testId,
  label,
  help,
  helpId,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  testId?: string;
  label: string;
  help: string;
  helpId: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={checkLabelStyle}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-testid={testId}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
      <FieldHelpIcon text={help} ariaLabel={`${label}の説明`} testId={helpId} />
    </label>
  );
}

function Field({
  label,
  help,
  helpId,
  children,
}: {
  label: string;
  help: string;
  helpId: string;
  children: ReactNode;
}) {
  return (
    <label style={labelStyle}>
      <LabelWithHelp text={label} help={help} helpId={helpId} />
      {children}
    </label>
  );
}

/** 資金管理・コストの編集ダイアログ。 */
export function BacktestMoneyManagementPanel({
  moneyManagement,
  cost,
  currency,
  symbols,
  onChangeMoneyManagement,
  onChangeCost,
  onClose,
}: BacktestMoneyManagementPanelProps) {
  const [tab, setTab] = useState<TabId>('basic');
  const mm = moneyManagement;

  const patchMm = (partial: Partial<MoneyManagementConfig>) => {
    onChangeMoneyManagement({ ...mm, ...partial });
  };

  return (
    <ModelessWindow title="資金管理" onClose={onClose} width={560} initialX={72} initialY={96}>
      <div data-testid="money-management-panel">
        <div style={tabRowStyle} role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-testid={`mm-tab-${t.id}`}
              style={tab === t.id ? tabActiveStyle : tabStyle}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'basic' ? (
          <div style={sectionStyle}>
            <CheckWithHelp
              checked={mm.enabled}
              testId="mm-enabled"
              label="タートルズ資金管理を使用"
              help={MM_HELP.enabled}
              helpId="mm-help-enabled"
              onChange={(enabled) => patchMm({ enabled })}
            />
            <Field label="リスク率（%）" help={MM_HELP.riskRate} helpId="mm-help-risk-rate">
              <input
                type="number"
                min={0}
                step={0.1}
                value={mm.riskRate * 100}
                disabled={!mm.enabled}
                onChange={(e) => patchMm({ riskRate: Number(e.target.value) / 100 })}
                style={inputStyle}
              />
            </Field>
            <Field label="ATR 期間" help={MM_HELP.atrPeriod} helpId="mm-help-atr-period">
              <input
                type="number"
                min={1}
                value={mm.atrPeriod}
                disabled={!mm.enabled}
                onChange={(e) => patchMm({ atrPeriod: Number(e.target.value) })}
                style={inputStyle}
              />
            </Field>
            <Field label="ATR 種類" help={MM_HELP.atrKind} helpId="mm-help-atr-kind">
              <select
                value={mm.atrKind}
                disabled={!mm.enabled}
                onChange={(e) =>
                  patchMm({ atrKind: e.target.value === 'atr' ? 'atr' : 'n' })
                }
                style={inputStyle}
              >
                <option value="n">N（タートルズ）</option>
                <option value="atr">ATR</option>
              </select>
            </Field>
            <Field label="ストップ倍率" help={MM_HELP.stopMultiple} helpId="mm-help-stop-multiple">
              <input
                type="number"
                min={0}
                step={0.1}
                value={mm.stopMultiple}
                disabled={!mm.enabled}
                onChange={(e) => patchMm({ stopMultiple: Number(e.target.value) })}
                style={inputStyle}
              />
            </Field>
            <Field label="最小数量" help={MM_HELP.minQuantity} helpId="mm-help-min-quantity">
              <input
                type="number"
                min={0}
                value={mm.minQuantity}
                disabled={!mm.enabled}
                onChange={(e) => patchMm({ minQuantity: Number(e.target.value) })}
                style={inputStyle}
              />
            </Field>
            <Field
              label="最大数量（空欄=制限なし）"
              help={MM_HELP.maxQuantity}
              helpId="mm-help-max-quantity"
            >
              <input
                type="number"
                min={0}
                value={mm.maxQuantity ?? ''}
                disabled={!mm.enabled}
                data-testid="mm-max-quantity"
                onChange={(e) =>
                  patchMm({
                    maxQuantity:
                      e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                style={inputStyle}
              />
            </Field>
            <CheckWithHelp
              checked={mm.allowFractionalQuantity}
              disabled={!mm.enabled}
              testId="mm-allow-fractional"
              label="小数数量を許可（OFF なら整数に切り捨て）"
              help={MM_HELP.allowFractional}
              helpId="mm-help-allow-fractional"
              onChange={(allowFractionalQuantity) => patchMm({ allowFractionalQuantity })}
            />
          </div>
        ) : null}

        {tab === 'cost' ? (
          <div style={sectionStyle}>
            <Field label="手数料モード" help={MM_HELP.feeMode} helpId="mm-help-fee-mode">
              <select
                value={cost.feeMode}
                data-testid="fee-mode"
                onChange={(e) =>
                  onChangeCost({
                    ...cost,
                    feeMode: e.target.value === 'fixed' ? 'fixed' : 'rate',
                  })
                }
                style={inputStyle}
              >
                <option value="rate">率（%）</option>
                <option value="fixed">固定額{currency ? `（${currency}）` : ''}</option>
              </select>
            </Field>
            {cost.feeMode === 'rate' ? (
              <Field label="手数料率（%）" help={MM_HELP.feeRate} helpId="mm-help-fee-rate">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cost.feeRate * 100}
                  data-testid="fee-rate"
                  onChange={(e) =>
                    onChangeCost({ ...cost, feeRate: Number(e.target.value) / 100 })
                  }
                  style={inputStyle}
                />
              </Field>
            ) : (
              <Field
                label={`固定手数料${currency ? `（${currency}）` : ''}`}
                help={MM_HELP.feeFixed}
                helpId="mm-help-fee-fixed"
              >
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={cost.feeFixed}
                  data-testid="fee-fixed"
                  onChange={(e) =>
                    onChangeCost({ ...cost, feeFixed: Number(e.target.value) })
                  }
                  style={inputStyle}
                />
              </Field>
            )}
            <Field label="スリッページ率（%）" help={MM_HELP.slippageRate} helpId="mm-help-slippage">
              <input
                type="number"
                min={0}
                step={0.01}
                value={cost.slippageRate * 100}
                data-testid="slippage-rate"
                onChange={(e) =>
                  onChangeCost({ ...cost, slippageRate: Number(e.target.value) / 100 })
                }
                style={inputStyle}
              />
            </Field>
            <p style={hintStyle}>手数料・スリッページは 0 も指定できます。</p>
          </div>
        ) : null}

        {tab === 'pyramid' ? (
          <div style={sectionStyle}>
            <CheckWithHelp
              checked={mm.pyramiding.enabled}
              disabled={!mm.enabled}
              label="ピラミッディングを使用"
              help={MM_HELP.pyramidingEnabled}
              helpId="mm-help-pyramid-enabled"
              onChange={(enabled) =>
                patchMm({ pyramiding: { ...mm.pyramiding, enabled } })
              }
            />
            <Field
              label="買い増し間隔（ATR 倍率）"
              help={MM_HELP.pyramidStep}
              helpId="mm-help-pyramid-step"
            >
              <input
                type="number"
                min={0}
                step={0.1}
                value={mm.pyramiding.stepAtrMultiple}
                disabled={!mm.enabled || !mm.pyramiding.enabled}
                onChange={(e) =>
                  patchMm({
                    pyramiding: {
                      ...mm.pyramiding,
                      stepAtrMultiple: Number(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
            </Field>
            <Field label="最大ユニット" help={MM_HELP.pyramidMaxUnits} helpId="mm-help-pyramid-max">
              <input
                type="number"
                min={1}
                value={mm.pyramiding.maxUnits}
                disabled={!mm.enabled || !mm.pyramiding.enabled}
                onChange={(e) =>
                  patchMm({
                    pyramiding: {
                      ...mm.pyramiding,
                      maxUnits: Number(e.target.value),
                    },
                  })
                }
                style={inputStyle}
              />
            </Field>
          </div>
        ) : null}

        {tab === 'drawdown' ? (
          <div style={sectionStyle}>
            <CheckWithHelp
              checked={mm.drawdown.enabled}
              disabled={!mm.enabled}
              label="ドローダウン管理を使用"
              help={MM_HELP.drawdownEnabled}
              helpId="mm-help-drawdown-enabled"
              onChange={(enabled) =>
                patchMm({ drawdown: { ...mm.drawdown, enabled } })
              }
            />
            <Field label="閾値（%）" help={MM_HELP.drawdownThreshold} helpId="mm-help-dd-threshold">
              <input
                type="number"
                min={0}
                step={1}
                value={mm.drawdown.thresholdRate * 100}
                disabled={!mm.enabled || !mm.drawdown.enabled}
                onChange={(e) =>
                  patchMm({
                    drawdown: {
                      ...mm.drawdown,
                      thresholdRate: Number(e.target.value) / 100,
                    },
                  })
                }
                style={inputStyle}
              />
            </Field>
            <Field
              label="リスク縮小率（%）"
              help={MM_HELP.drawdownReduction}
              helpId="mm-help-dd-reduction"
            >
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={mm.drawdown.riskReductionRate * 100}
                disabled={!mm.enabled || !mm.drawdown.enabled}
                onChange={(e) =>
                  patchMm({
                    drawdown: {
                      ...mm.drawdown,
                      riskReductionRate: Number(e.target.value) / 100,
                    },
                  })
                }
                style={inputStyle}
              />
            </Field>
          </div>
        ) : null}

        {tab === 'correlation' ? (
          <div style={sectionStyle}>
            <CheckWithHelp
              checked={mm.correlation.enabled}
              disabled={!mm.enabled}
              label="相関管理を使用"
              help={MM_HELP.correlationEnabled}
              helpId="mm-help-corr-enabled"
              onChange={(enabled) =>
                patchMm({ correlation: { ...mm.correlation, enabled } })
              }
            />
            <p style={hintStyle}>
              単一銘柄バックテストでは、実行銘柄が属するグループの最大ユニット／最大リスクを適用します。
            </p>
            {mm.correlation.groups.map((group, index) => (
              <fieldset key={index} style={fieldsetStyle} data-testid={`corr-group-${index}`}>
                <legend>グループ {index + 1}</legend>
                <Field label="名前" help={MM_HELP.corrName} helpId={`mm-help-corr-name-${index}`}>
                  <input
                    type="text"
                    value={group.name}
                    disabled={!mm.enabled || !mm.correlation.enabled}
                    onChange={(e) => {
                      const groups = mm.correlation.groups.slice();
                      groups[index] = { ...group, name: e.target.value };
                      patchMm({ correlation: { ...mm.correlation, groups } });
                    }}
                    style={inputStyle}
                  />
                </Field>
                <Field
                  label="銘柄（複数選択）"
                  help={MM_HELP.corrSymbols}
                  helpId={`mm-help-corr-symbols-${index}`}
                >
                  <select
                    multiple
                    value={group.symbolIds}
                    disabled={!mm.enabled || !mm.correlation.enabled}
                    size={Math.min(6, Math.max(3, symbols.length))}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                      const groups = mm.correlation.groups.slice();
                      groups[index] = { ...group, symbolIds: selected };
                      patchMm({ correlation: { ...mm.correlation, groups } });
                    }}
                    style={inputStyle}
                  >
                    {symbols.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.ticker} ({s.market})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="最大ユニット"
                  help={MM_HELP.corrMaxUnits}
                  helpId={`mm-help-corr-max-units-${index}`}
                >
                  <input
                    type="number"
                    min={1}
                    value={group.maxUnits}
                    disabled={!mm.enabled || !mm.correlation.enabled}
                    onChange={(e) => {
                      const groups = mm.correlation.groups.slice();
                      groups[index] = { ...group, maxUnits: Number(e.target.value) };
                      patchMm({ correlation: { ...mm.correlation, groups } });
                    }}
                    style={inputStyle}
                  />
                </Field>
                <Field
                  label="最大リスク（%）"
                  help={MM_HELP.corrMaxRisk}
                  helpId={`mm-help-corr-max-risk-${index}`}
                >
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={group.maxRisk * 100}
                    disabled={!mm.enabled || !mm.correlation.enabled}
                    onChange={(e) => {
                      const groups = mm.correlation.groups.slice();
                      groups[index] = {
                        ...group,
                        maxRisk: Number(e.target.value) / 100,
                      };
                      patchMm({ correlation: { ...mm.correlation, groups } });
                    }}
                    style={inputStyle}
                  />
                </Field>
                <button
                  type="button"
                  style={buttonStyle}
                  disabled={!mm.enabled || !mm.correlation.enabled}
                  onClick={() => {
                    const groups = mm.correlation.groups.filter((_, i) => i !== index);
                    patchMm({ correlation: { ...mm.correlation, groups } });
                  }}
                >
                  このグループを削除
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              style={buttonStyle}
              disabled={!mm.enabled || !mm.correlation.enabled}
              data-testid="corr-add-group"
              onClick={() =>
                patchMm({
                  correlation: {
                    ...mm.correlation,
                    groups: [
                      ...mm.correlation.groups,
                      { name: '', symbolIds: [], maxUnits: 4, maxRisk: 0.04 },
                    ],
                  },
                })
              }
            >
              グループを追加
            </button>
            <span style={resetRowStyle}>
              <button
                type="button"
                style={buttonStyle}
                disabled={!mm.enabled}
                onClick={() =>
                  onChangeMoneyManagement({ ...DEFAULT_MONEY_MANAGEMENT, enabled: true })
                }
              >
                基本設定をリセット
              </button>
              <FieldHelpIcon
                text={MM_HELP.resetDefaults}
                ariaLabel="基本設定をリセットの説明"
                testId="mm-help-reset"
              />
            </span>
          </div>
        ) : null}
      </div>
    </ModelessWindow>
  );
}

const tabRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.35rem',
  marginBottom: '0.75rem',
};
const tabStyle: CSSProperties = {
  padding: '0.35rem 0.65rem',
  border: '1px solid #ccc',
  background: '#f7f7f7',
  cursor: 'pointer',
};
const tabActiveStyle: CSSProperties = {
  padding: '0.35rem 0.65rem',
  border: '1px solid #333',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: '600',
};
const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.65rem',
};
const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  fontSize: '0.9rem',
};
const labelRowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.2rem',
};
const checkLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.95rem',
};
const inputStyle: CSSProperties = {
  padding: '0.35rem 0.5rem',
  border: '1px solid #ccc',
  borderRadius: 4,
};
const hintStyle: CSSProperties = { margin: 0, fontSize: '0.85rem', opacity: 0.8 };
const fieldsetStyle: CSSProperties = {
  border: '1px solid #ddd',
  padding: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};
const buttonStyle: CSSProperties = {
  padding: '0.35rem 0.75rem',
  cursor: 'pointer',
  alignSelf: 'flex-start',
};
const resetRowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
};
