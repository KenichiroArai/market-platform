/**
 * バックテスト画面のタブ切替（v0.3.0 Ph5 / v0.4.0 Ph3）。
 *
 * 設定と実行 / 結果 / 日次データの3タブ。結果詳細は結果タブ内で縦にまとめる。
 */
'use client';

import type { CSSProperties, ReactNode } from 'react';

/** バックテスト作業領域のタブ ID。 */
export type BacktestWorkspaceTabId = 'setup' | 'results' | 'daily';

export type BacktestWorkspaceTab = {
  id: BacktestWorkspaceTabId;
  label: string;
};

export const BACKTEST_WORKSPACE_TABS: readonly BacktestWorkspaceTab[] = [
  { id: 'setup', label: '設定と実行' },
  { id: 'results', label: '結果' },
  { id: 'daily', label: '日次データ' },
] as const;

export type BacktestWorkspaceTabsProps = {
  activeTab: BacktestWorkspaceTabId;
  onChange: (tab: BacktestWorkspaceTabId) => void;
  children: ReactNode;
};

/** タブバーと選択中パネルを描画する。 */
export function BacktestWorkspaceTabs({
  activeTab,
  onChange,
  children,
}: BacktestWorkspaceTabsProps) {
  return (
    <div style={rootStyle}>
      <div role="tablist" aria-label="バックテスト表示" style={tabListStyle}>
        {BACKTEST_WORKSPACE_TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`backtest-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`backtest-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              data-testid={`backtest-tab-${tab.id}`}
              style={selected ? activeTabStyle : tabStyle}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`backtest-panel-${activeTab}`}
        aria-labelledby={`backtest-tab-${activeTab}`}
        data-testid={`backtest-panel-${activeTab}`}
        style={panelStyle}
      >
        {children}
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = {
  marginTop: '1.25rem',
  maxWidth: 'min(100%, 90rem)',
};

const tabListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.25rem 0.5rem',
  borderBottom: '1px solid rgba(232, 238, 245, 0.25)',
  paddingBottom: 0,
};

const tabStyle: CSSProperties = {
  padding: '0.55rem 0.85rem',
  border: 'none',
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
  background: 'transparent',
  color: '#e8eef5',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: 400,
  cursor: 'pointer',
  opacity: 0.75,
  marginBottom: '-1px',
};

const activeTabStyle: CSSProperties = {
  ...tabStyle,
  opacity: 1,
  fontWeight: 600,
  borderBottomColor: 'rgba(126, 184, 255, 0.95)',
};

const panelStyle: CSSProperties = {
  marginTop: '1rem',
};
