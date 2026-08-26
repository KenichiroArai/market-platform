/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import {
  BacktestWorkspaceTabs,
  type BacktestWorkspaceTabId,
} from '../../components/backtest-workspace-tabs';

describe('BacktestWorkspaceTabs', () => {
  it('renders tabs and switches active panel on click', () => {
    const onChange = jest.fn();
    let activeTab: BacktestWorkspaceTabId = 'run';

    const { rerender } = render(
      <BacktestWorkspaceTabs activeTab={activeTab} onChange={onChange}>
        <div>実行パネル</div>
      </BacktestWorkspaceTabs>,
    );

    expect(screen.getByRole('tab', { name: '実行' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('backtest-panel-run')).toHaveTextContent('実行パネル');

    fireEvent.click(screen.getByRole('tab', { name: 'チャート' }));
    expect(onChange).toHaveBeenCalledWith('chart');

    activeTab = 'chart';
    rerender(
      <BacktestWorkspaceTabs activeTab={activeTab} onChange={onChange}>
        <div>チャートパネル</div>
      </BacktestWorkspaceTabs>,
    );
    expect(screen.getByRole('tab', { name: 'チャート' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('backtest-panel-chart')).toHaveTextContent('チャートパネル');
  });
});
