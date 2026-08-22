/**
 * @jest-environment jsdom
 */
import {
  enlargedChartHeight,
  nextIndicatorUiMode,
  nextOpenToggle,
} from '../../components/chart-window-state';

describe('chart-window-state', () => {
  it('opens, closes, and switches via nextOpenToggle with preferred mode', () => {
    expect(nextOpenToggle('closed', 'modeless')).toBe('modeless');
    expect(nextOpenToggle('closed', 'popout')).toBe('popout');
    expect(nextOpenToggle('modeless', 'modeless')).toBe('closed');
    expect(nextOpenToggle('popout', 'popout')).toBe('closed');
    expect(nextOpenToggle('modeless', 'popout')).toBe('popout');
    expect(nextOpenToggle('popout', 'modeless')).toBe('modeless');
  });

  it('keeps nextIndicatorUiMode as an alias of nextOpenToggle', () => {
    expect(nextIndicatorUiMode('closed', 'modeless')).toBe('modeless');
    expect(nextIndicatorUiMode('modeless', 'modeless')).toBe('closed');
    expect(nextIndicatorUiMode('modeless', 'popout')).toBe('popout');
    expect(nextIndicatorUiMode('popout', 'popout')).toBe('closed');
  });

  it('picks the larger height for the enlarged chart', () => {
    expect(enlargedChartHeight(400, 900)).toBe(900);
    expect(enlargedChartHeight(800, 500)).toBe(800);
  });
});
