import {
  AddPortfolioHoldingDto,
  CreatePortfolioDto,
  UpdatePortfolioDto,
  UpdatePortfolioHoldingDto,
} from './portfolios.dto';

describe('portfolio DTOs', () => {
  it('constructs Create / Update / Holding DTOs', () => {
    const create = new CreatePortfolioDto();
    create.name = 'Core';
    expect(create.name).toBe('Core');

    const update = new UpdatePortfolioDto();
    update.name = 'Satellite';
    expect(update.name).toBe('Satellite');

    const add = new AddPortfolioHoldingDto();
    add.symbolId = 'sym_1';
    add.quantity = 10;
    add.averageCost = 100;
    expect(add.quantity).toBe(10);

    const patch = new UpdatePortfolioHoldingDto();
    patch.quantity = 12;
    patch.averageCost = 98;
    expect(patch.averageCost).toBe(98);
  });
});
