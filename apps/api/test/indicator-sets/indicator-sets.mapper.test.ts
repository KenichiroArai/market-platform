import { toIndicatorSetDto, toSavedIndicatorIds } from '../../src/indicator-sets/indicator-sets.mapper';

describe('indicator-sets.mapper', () => {
  const row = {
    id: 'set_1',
    userId: 'user_1',
    name: 'スイング',
    indicatorIds: ['sma25', 'rsi'],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('maps a valid row', () => {
    const dto = toIndicatorSetDto(row);
    expect(dto).toEqual({
      id: 'set_1',
      userId: 'user_1',
      name: 'スイング',
      indicatorIds: ['sma25', 'rsi'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('drops unknown and disabled ids when recovering', () => {
    expect(toSavedIndicatorIds(['sma25', 'nope'])).toEqual(['sma25']);
    expect(toSavedIndicatorIds(['nope', 'elliott'])).toEqual([]);
    expect(toSavedIndicatorIds(['sma25', 'sma25', 'volume'])).toEqual(['sma25', 'volume']);
  });
});
