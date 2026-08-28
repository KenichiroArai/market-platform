/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { TREND_SCORE_GROUP_WEIGHTS } from '@market/shared-types';
import {
  IndicatorScoreConfigForm,
  defaultGroupWeights,
  isScoreConfigValid,
  parseScoreWeightInput,
  applyGroupWeightChange,
} from '../../components/indicator-score-config-form';

describe('IndicatorScoreConfigForm', () => {
  it('validates score config helper', () => {
    expect(isScoreConfigValid(TREND_SCORE_GROUP_WEIGHTS, 37.5, -42.5)).toBe(true);
    expect(isScoreConfigValid({ ...TREND_SCORE_GROUP_WEIGHTS, trend: 50 }, 37.5, -42.5)).toBe(false);
    expect(isScoreConfigValid(TREND_SCORE_GROUP_WEIGHTS, 10, 20)).toBe(false);
    expect(defaultGroupWeights()).toEqual(TREND_SCORE_GROUP_WEIGHTS);
    expect(parseScoreWeightInput('45')).toBe(45);
    expect(parseScoreWeightInput('abc')).toBeNull();
    expect(applyGroupWeightChange(TREND_SCORE_GROUP_WEIGHTS, 'trend', '45')).toEqual(
      expect.objectContaining({ trend: 45 }),
    );
    expect(applyGroupWeightChange(TREND_SCORE_GROUP_WEIGHTS, 'trend', 'abc')).toBeNull();
  });

  it('updates weights and thresholds', () => {
    const onGroupWeightsChange = jest.fn();
    const onBuyThresholdChange = jest.fn();
    const onSellThresholdChange = jest.fn();
    render(
      <IndicatorScoreConfigForm
        groupWeights={TREND_SCORE_GROUP_WEIGHTS}
        buyThreshold={37.5}
        sellThreshold={-42.5}
        onGroupWeightsChange={onGroupWeightsChange}
        onBuyThresholdChange={onBuyThresholdChange}
        onSellThresholdChange={onSellThresholdChange}
      />,
    );
    expect(screen.getByTestId('group-weight-sum')).toHaveTextContent('合計: 100%');
    fireEvent.change(screen.getByTestId('group-weight-trend'), { target: { value: '45' } });
    expect(onGroupWeightsChange).toHaveBeenCalledWith(
      expect.objectContaining({ trend: 45 }),
    );
    fireEvent.change(screen.getByTestId('buy-threshold'), { target: { value: '50' } });
    expect(onBuyThresholdChange).toHaveBeenCalledWith(50);
    fireEvent.change(screen.getByTestId('sell-threshold'), { target: { value: '-50' } });
    expect(onSellThresholdChange).toHaveBeenCalledWith(-50);
  });

  it('shows validation errors for invalid thresholds', () => {
    render(
      <IndicatorScoreConfigForm
        groupWeights={{ ...TREND_SCORE_GROUP_WEIGHTS, trend: 50 }}
        buyThreshold={10}
        sellThreshold={20}
        onGroupWeightsChange={jest.fn()}
        onBuyThresholdChange={jest.fn()}
        onSellThresholdChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId('group-weight-sum')).toHaveTextContent('100% にしてください');
    expect(screen.getByTestId('threshold-error')).toBeInTheDocument();
  });
});
