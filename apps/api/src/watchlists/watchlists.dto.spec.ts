import {
  AddWatchlistItemDto,
  CreateWatchlistDto,
  UpdateWatchlistDto,
} from './watchlists.dto';

describe('watchlist DTOs', () => {
  it('constructs Create / Update / AddItem DTOs', () => {
    const create = new CreateWatchlistDto();
    create.name = 'Tech';
    expect(create.name).toBe('Tech');

    const update = new UpdateWatchlistDto();
    update.name = 'Growth';
    expect(update.name).toBe('Growth');

    const add = new AddWatchlistItemDto();
    add.symbolId = 'sym_1';
    expect(add.symbolId).toBe('sym_1');
  });
});
