/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { IndicatorCatalogId } from '@market/shared-types';
import {
  IndicatorCatalog,
  applyRecommendedIds,
  clearIndicatorIds,
  toggleIndicatorId,
} from '../../components/indicator-catalog';

function Harness({ initial }: { initial: IndicatorCatalogId[] }) {
  const [ids, setIds] = useState(() => new Set(initial));
  return <IndicatorCatalog enabledIds={ids} onChange={setIds} />;
}

describe('indicator-catalog helpers', () => {
  it('toggles ids and ignores elliott', () => {
    const empty = new Set<IndicatorCatalogId>();
    const on = toggleIndicatorId(empty, 'rsi');
    expect(on.has('rsi')).toBe(true);
    expect(toggleIndicatorId(on, 'rsi').has('rsi')).toBe(false);
    expect(toggleIndicatorId(empty, 'elliott').size).toBe(0);
  });

  it('applies recommended and clears', () => {
    const withVolume = applyRecommendedIds(new Set(['volume']));
    expect(withVolume.has('sma25')).toBe(true);
    expect(withVolume.has('volume')).toBe(true);
    const withoutVolume = applyRecommendedIds(new Set(['rsi']));
    expect(withoutVolume.has('volume')).toBe(false);
    expect(clearIndicatorIds().size).toBe(0);
  });
});

describe('IndicatorCatalog', () => {
  it('renders categories and updates description on focus', () => {
    render(<Harness initial={['sma25', 'volume']} />);
    expect(screen.getByTestId('indicator-catalog')).toBeInTheDocument();
    expect(screen.getByText('トレンド系')).toBeInTheDocument();
    expect(screen.getByTestId('indicator-description')).toHaveTextContent('指標名をクリック');
    fireEvent.focus(screen.getAllByTestId('overlay-rsi')[0]!);
    expect(screen.getByTestId('indicator-description')).toHaveTextContent('RSI');
    fireEvent.click(screen.getAllByTestId('overlay-rsi')[0]!);
    fireEvent.click(screen.getByTestId('apply-recommended'));
    fireEvent.click(screen.getByTestId('clear-indicators'));
    expect(screen.getByTestId('overlay-sma25')).not.toBeChecked();
  });
});
