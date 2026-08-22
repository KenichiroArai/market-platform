import type { IndicatorCatalogId, IndicatorSetDto } from '@market/shared-types';
import { filterIndicatorSets } from '../../lib/indicator-set-filter';

describe('filterIndicatorSets', () => {
  const sets: IndicatorSetDto[] = [
    {
      id: 'a',
      userId: 'u',
      name: 'スイング',
      indicatorIds: ['sma25', 'rsi'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'b',
      userId: 'u',
      name: 'Day trade',
      indicatorIds: ['macd', 'rsi', 'volume'],
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 'c',
      userId: 'u',
      name: '空',
      indicatorIds: [],
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    },
  ];

  it('returns all when query and required ids are empty', () => {
    expect(filterIndicatorSets(sets, '  ', new Set())).toHaveLength(3);
  });

  it('filters by name case-insensitively', () => {
    expect(filterIndicatorSets(sets, 'swing', new Set()).map((s) => s.id)).toEqual([]);
    expect(filterIndicatorSets(sets, 'DAY', new Set()).map((s) => s.id)).toEqual(['b']);
    expect(filterIndicatorSets(sets, 'スイン', new Set()).map((s) => s.id)).toEqual(['a']);
  });

  it('requires all checked indicators (AND)', () => {
    const rsi = new Set<IndicatorCatalogId>(['rsi']);
    expect(filterIndicatorSets(sets, '', rsi).map((s) => s.id)).toEqual(['a', 'b']);
    const rsiMacd = new Set<IndicatorCatalogId>(['rsi', 'macd']);
    expect(filterIndicatorSets(sets, '', rsiMacd).map((s) => s.id)).toEqual(['b']);
    const volume = new Set<IndicatorCatalogId>(['volume']);
    expect(filterIndicatorSets(sets, '', volume).map((s) => s.id)).toEqual(['b']);
  });

  it('combines name and indicator filters', () => {
    const rsi = new Set<IndicatorCatalogId>(['rsi']);
    expect(filterIndicatorSets(sets, 'スイング', rsi).map((s) => s.id)).toEqual(['a']);
    expect(filterIndicatorSets(sets, 'スイング', new Set<IndicatorCatalogId>(['macd']))).toEqual([]);
  });
});
