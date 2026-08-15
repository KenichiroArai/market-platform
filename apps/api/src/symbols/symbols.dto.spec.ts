import { CreateSymbolDto, UpdateSymbolDto } from './symbols.dto';
import { SyncPricesDto } from '../market-data/market-data.dto';

/**
 * DTO クラスがインスタンス化できることを確認する。
 * バリデーション自体は ValidationPipe の責務のため、ここではメタデータ付きクラスの存在を担保する。
 */
describe('market DTOs', () => {
  it('constructs CreateSymbolDto / UpdateSymbolDto / SyncPricesDto', () => {
    const create = new CreateSymbolDto();
    create.ticker = 'AAPL';
    create.market = 'US';
    expect(create.ticker).toBe('AAPL');

    const update = new UpdateSymbolDto();
    update.isActive = false;
    expect(update.isActive).toBe(false);

    const sync = new SyncPricesDto();
    sync.symbolIds = ['s1'];
    sync.from = '2026-01-01';
    sync.to = '2026-01-02';
    expect(sync.symbolIds).toEqual(['s1']);
  });
});
