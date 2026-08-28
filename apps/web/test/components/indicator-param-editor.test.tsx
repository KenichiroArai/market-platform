/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { IndicatorCatalogId } from '@market/shared-types';
import {
  IndicatorParamEditor,
  applyIndicatorParamChange,
  isIndicatorParamOutOfRange,
  resolvedIndicatorParamValue,
} from '../../components/indicator-param-editor';

describe('indicator param helpers', () => {
  it('applies valid, default, invalid, and unknown-key changes', () => {
    expect(applyIndicatorParamChange({}, 'sma25', 'period', '30')).toEqual({
      sma25: { period: 30 },
    });
    expect(applyIndicatorParamChange({ sma25: { period: 30 } }, 'sma25', 'period', '25')).toEqual(
      {},
    );
    expect(applyIndicatorParamChange({}, 'sma25', 'period', '9999')).toEqual({
      sma25: { period: 9999 },
    });
    expect(applyIndicatorParamChange({}, 'sma25', 'missing', '10')).toBeNull();
    expect(resolvedIndicatorParamValue({ sma25: { period: 30 } }, 'sma25', 'period')).toBe(30);
    expect(resolvedIndicatorParamValue({}, 'sma25', 'period')).toBe(25);
    expect(isIndicatorParamOutOfRange({ sma25: { period: 9999 } }, 'sma25', 'period')).toBe(true);
    expect(isIndicatorParamOutOfRange({}, 'sma25', 'missing')).toBe(false);
  });
});

describe('IndicatorParamEditor', () => {
  it('shows empty hint when no editable indicators are enabled', () => {
    render(
      <IndicatorParamEditor
        enabledIds={new Set<IndicatorCatalogId>(['volume'])}
        params={{}}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId('indicator-param-editor-empty')).toBeInTheDocument();
  });

  it('renders as a collapsible details section', () => {
    render(
      <IndicatorParamEditor
        enabledIds={new Set<IndicatorCatalogId>(['sma25'])}
        params={{}}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId('indicator-param-editor')).toHaveAttribute('open');
    expect(screen.getByText('1 件の指標')).toBeInTheDocument();
  });

  it('edits params through the UI', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <IndicatorParamEditor
        enabledIds={new Set<IndicatorCatalogId>(['sma25'])}
        params={{}}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId('param-sma25-period'), { target: { value: '30' } });
    expect(onChange).toHaveBeenCalledWith({ sma25: { period: 30 } });

    rerender(
      <IndicatorParamEditor
        enabledIds={new Set<IndicatorCatalogId>(['sma25'])}
        params={{ sma25: { period: 9999 } }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('2〜500')).toBeInTheDocument();
  });

  it('renders decimal steps for psar params', () => {
    render(
      <IndicatorParamEditor
        enabledIds={new Set<IndicatorCatalogId>(['psar'])}
        params={{}}
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId('param-psar-step')).toHaveAttribute('step', '0.01');
    expect(screen.getByTestId('param-psar-maxStep')).toHaveAttribute('step', '0.01');
  });
});
