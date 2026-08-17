/**
 * @jest-environment jsdom
 */
import { enlargedChartHeight, nextIndicatorUiMode } from './chart-window-state';

describe('chart-window-state', () => {
  it('toggles and switches indicator UI modes', () => {
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
