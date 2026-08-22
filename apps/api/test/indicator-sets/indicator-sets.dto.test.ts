import { CreateIndicatorSetDto } from '../../src/indicator-sets/indicator-sets.dto';

describe('indicator-set DTOs', () => {
  it('constructs CreateIndicatorSetDto', () => {
    const create = new CreateIndicatorSetDto();
    create.name = 'スイング';
    create.indicatorIds = ['sma25', 'rsi'];
    expect(create.name).toBe('スイング');
    expect(create.indicatorIds).toEqual(['sma25', 'rsi']);
  });
});
