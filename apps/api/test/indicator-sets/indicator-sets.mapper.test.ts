import { TREND_SCORE_GROUP_WEIGHTS } from '@market/shared-types';
import { toIndicatorSetDto, toSavedIndicatorIds } from '../../src/indicator-sets/indicator-sets.mapper';

describe('indicator-sets.mapper', () => {
  const row = {
    id: 'set_1',
    userId: 'user_1',
    name: 'スイング',
    indicatorIds: ['sma25', 'rsi'],
    indicatorParams: {},
    groupWeights: null,
    buyThreshold: null,
    sellThreshold: null,
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
      indicatorParams: {},
      groupWeights: null,
      buyThreshold: null,
      sellThreshold: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('drops unknown and disabled ids when recovering', () => {
    expect(toSavedIndicatorIds(['sma25', 'nope'])).toEqual(['sma25']);
    expect(toSavedIndicatorIds(['nope', 'elliott'])).toEqual([]);
    expect(toSavedIndicatorIds(['sma25', 'sma25', 'volume'])).toEqual(['sma25', 'volume']);
  });

  it('maps indicator params and group weights from json', () => {
    const dto = toIndicatorSetDto({
      ...row,
      indicatorParams: {
        sma25: { period: 30 },
        bad: 'x',
        arr: [],
        nullEntry: null,
      },
      groupWeights: { ...TREND_SCORE_GROUP_WEIGHTS },
      buyThreshold: 50,
      sellThreshold: -50,
    });
    expect(dto.indicatorParams).toEqual({ sma25: { period: 30 } });
    expect(dto.groupWeights).toEqual(TREND_SCORE_GROUP_WEIGHTS);
    expect(dto.buyThreshold).toBe(50);
    expect(dto.sellThreshold).toBe(-50);
  });

  it('returns empty params and null weights for invalid json', () => {
    expect(toIndicatorSetDto({ ...row, indicatorParams: null }).indicatorParams).toEqual({});
    expect(toIndicatorSetDto({ ...row, indicatorParams: ['a'] }).indicatorParams).toEqual({});
    expect(toIndicatorSetDto({ ...row, groupWeights: { trend: 40 } }).groupWeights).toBeNull();
    expect(toIndicatorSetDto({ ...row, groupWeights: 'bad' }).groupWeights).toBeNull();
  });
});
