/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_MONEY_MANAGEMENT, type MoneyManagementConfig } from '@market/shared-types';
import { BacktestMoneyManagementPanel } from '../../components/backtest-money-management-panel';

jest.mock('../../components/modeless-window', () => ({
  ModelessWindow: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="mm-dialog">
      <span>{title}</span>
      {children}
    </div>
  ),
}));

const symbol = {
  id: 's1',
  ticker: 'AAPL',
  market: 'US' as const,
  name: 'Apple',
  currency: 'USD',
  exchange: 'NMS',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function Panel(props: {
  mm: MoneyManagementConfig;
  cost?: {
    feeMode: 'rate' | 'fixed';
    feeRate: number;
    feeFixed: number;
    slippageRate: number;
  };
  currency?: string | null;
  onMm?: (next: MoneyManagementConfig) => void;
  onCost?: jest.Mock;
  onClose?: jest.Mock;
}) {
  return (
    <BacktestMoneyManagementPanel
      moneyManagement={props.mm}
      cost={
        props.cost ?? { feeMode: 'rate', feeRate: 0.001, feeFixed: 0, slippageRate: 0.001 }
      }
      currency={props.currency === undefined ? 'USD' : props.currency}
      symbols={[symbol]}
      onChangeMoneyManagement={props.onMm ?? jest.fn()}
      onChangeCost={props.onCost ?? jest.fn()}
      onClose={props.onClose ?? jest.fn()}
    />
  );
}

describe('BacktestMoneyManagementPanel', () => {
  it('covers basic tab inputs', () => {
    let mm: MoneyManagementConfig = { ...DEFAULT_MONEY_MANAGEMENT, enabled: true };
    const onMm = jest.fn((next: MoneyManagementConfig) => {
      mm = next;
    });
    const { rerender } = render(<Panel mm={mm} onMm={onMm} />);

    fireEvent.click(screen.getByTestId('mm-enabled'));
    expect(onMm).toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue('1'), { target: { value: '2' } });
    fireEvent.change(screen.getByDisplayValue(String(DEFAULT_MONEY_MANAGEMENT.atrPeriod)), {
      target: { value: '14' },
    });
    const atrKind = screen.getByDisplayValue('N（タートルズ）');
    fireEvent.change(atrKind, { target: { value: 'atr' } });
    fireEvent.change(screen.getByDisplayValue(String(DEFAULT_MONEY_MANAGEMENT.stopMultiple)), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByDisplayValue(String(DEFAULT_MONEY_MANAGEMENT.minQuantity)), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByTestId('mm-max-quantity'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('mm-max-quantity'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('mm-allow-fractional'));

    rerender(<Panel mm={{ ...mm, atrKind: 'atr', maxQuantity: 50 }} onMm={onMm} />);
    fireEvent.change(screen.getByDisplayValue('ATR'), { target: { value: 'n' } });
    fireEvent.change(screen.getByTestId('mm-max-quantity'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('mm-max-quantity'), { target: { value: '10' } });

    fireEvent.mouseEnter(screen.getByTestId('mm-help-risk-rate'));
    expect(screen.getByTestId('mm-help-risk-rate-tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByTestId('mm-help-risk-rate'));
  });

  it('covers cost tab rate and fixed modes', () => {
    const onCost = jest.fn();
    const mm = { ...DEFAULT_MONEY_MANAGEMENT, enabled: true };
    const { rerender } = render(<Panel mm={mm} onCost={onCost} currency="USD" />);

    fireEvent.click(screen.getByTestId('mm-tab-cost'));
    fireEvent.change(screen.getByTestId('fee-rate'), { target: { value: '0.2' } });
    fireEvent.change(screen.getByTestId('slippage-rate'), { target: { value: '0.05' } });
    fireEvent.change(screen.getByTestId('fee-mode'), { target: { value: 'fixed' } });
    expect(onCost).toHaveBeenCalled();

    rerender(
      <Panel
        mm={mm}
        onCost={onCost}
        cost={{ feeMode: 'fixed', feeRate: 0, feeFixed: 100, slippageRate: 0 }}
        currency="USD"
      />,
    );
    fireEvent.click(screen.getByTestId('mm-tab-cost'));
    expect(screen.getByTestId('fee-fixed')).toBeInTheDocument();
    expect(screen.getByText(/固定手数料（USD）/)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('fee-fixed'), { target: { value: '50' } });

    rerender(
      <Panel
        mm={mm}
        onCost={onCost}
        cost={{ feeMode: 'fixed', feeRate: 0, feeFixed: 100, slippageRate: 0 }}
        currency={null}
      />,
    );
    fireEvent.click(screen.getByTestId('mm-tab-cost'));
    expect(screen.getByTestId('fee-fixed')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('fee-mode'), { target: { value: 'rate' } });
  });

  it('covers pyramid and drawdown tabs', () => {
    let mm: MoneyManagementConfig = {
      ...DEFAULT_MONEY_MANAGEMENT,
      enabled: true,
      pyramiding: { enabled: true, stepAtrMultiple: 0.5, maxUnits: 4 },
      drawdown: { enabled: true, thresholdRate: 0.1, riskReductionRate: 0.5 },
    };
    const onMm = jest.fn((next: MoneyManagementConfig) => {
      mm = next;
    });
    const { rerender } = render(<Panel mm={mm} onMm={onMm} />);

    fireEvent.click(screen.getByTestId('mm-tab-pyramid'));
    const pyramid = screen.getByText('ピラミッディングを使用').closest('label');
    fireEvent.click(within(pyramid!).getByRole('checkbox'));
    fireEvent.change(screen.getByDisplayValue('0.5'), { target: { value: '1' } });
    fireEvent.change(screen.getByDisplayValue('4'), { target: { value: '5' } });

    rerender(<Panel mm={mm} onMm={onMm} />);
    fireEvent.click(screen.getByTestId('mm-tab-drawdown'));
    const dd = screen.getByText('ドローダウン管理を使用').closest('label');
    fireEvent.click(within(dd!).getByRole('checkbox'));
    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '20' } });
    fireEvent.change(screen.getByDisplayValue('50'), { target: { value: '25' } });
  });

  it('covers correlation groups and reset', () => {
    let mm: MoneyManagementConfig = {
      ...DEFAULT_MONEY_MANAGEMENT,
      enabled: true,
      correlation: {
        enabled: true,
        groups: [{ name: 'tech', symbolIds: ['s1'], maxUnits: 2, maxRisk: 0.02 }],
      },
    };
    const onMm = jest.fn((next: MoneyManagementConfig) => {
      mm = next;
    });
    const { rerender } = render(<Panel mm={mm} onMm={onMm} />);

    fireEvent.click(screen.getByTestId('mm-tab-correlation'));
    const corrEnable = screen.getByText('相関管理を使用').closest('label');
    fireEvent.click(within(corrEnable!).getByRole('checkbox'));

    const group = screen.getByTestId('corr-group-0');
    fireEvent.change(within(group).getByDisplayValue('tech'), { target: { value: 'group-a' } });
    const numericInputs = within(group).getAllByDisplayValue('2');
    fireEvent.change(numericInputs[0]!, { target: { value: '3' } });
    fireEvent.change(numericInputs[1]!, { target: { value: '4' } });
    const select = within(group).getByRole('listbox');
    const option = within(select).getByRole('option', { name: /AAPL/ }) as HTMLOptionElement;
    option.selected = true;
    fireEvent.change(select);

    fireEvent.click(within(group).getByText('このグループを削除'));
    expect(onMm).toHaveBeenCalled();

    rerender(
      <Panel
        mm={{
          ...mm,
          correlation: { enabled: true, groups: [] },
        }}
        onMm={onMm}
      />,
    );
    fireEvent.click(screen.getByTestId('mm-tab-correlation'));
    fireEvent.click(screen.getByTestId('corr-add-group'));
    fireEvent.click(screen.getByText('基本設定をリセット'));
    expect(onMm).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, riskRate: DEFAULT_MONEY_MANAGEMENT.riskRate }),
    );
  });
});
