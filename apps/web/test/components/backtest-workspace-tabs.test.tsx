/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import {
  BacktestWorkspaceTabs,
  type BacktestWorkspaceTabId,
} from '../../components/backtest-workspace-tabs';

describe('BacktestWorkspaceTabs', () => {
  it('renders setup/results/daily tabs and switches active panel on click', () => {
    const onChange = jest.fn();
    let activeTab: BacktestWorkspaceTabId = 'setup';

    const { rerender } = render(
      <BacktestWorkspaceTabs activeTab={activeTab} onChange={onChange}>
        <div>設定パネル</div>
      </BacktestWorkspaceTabs>,
    );

    expect(screen.getByRole('tab', { name: '設定と実行' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('backtest-panel-setup')).toHaveTextContent('設定パネル');
    expect(screen.getByRole('tab', { name: '結果' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '日次データ' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '実行' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '結果' }));
    expect(onChange).toHaveBeenCalledWith('results');

    activeTab = 'results';
    rerender(
      <BacktestWorkspaceTabs activeTab={activeTab} onChange={onChange}>
        <div>結果パネル</div>
      </BacktestWorkspaceTabs>,
    );
    expect(screen.getByRole('tab', { name: '結果' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('backtest-panel-results')).toHaveTextContent('結果パネル');

    fireEvent.click(screen.getByRole('tab', { name: '日次データ' }));
    expect(onChange).toHaveBeenCalledWith('daily');

    activeTab = 'daily';
    rerender(
      <BacktestWorkspaceTabs activeTab={activeTab} onChange={onChange}>
        <div>日次パネル</div>
      </BacktestWorkspaceTabs>,
    );
    expect(screen.getByRole('tab', { name: '日次データ' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('backtest-panel-daily')).toHaveTextContent('日次パネル');
  });
});
