import { Test } from '@nestjs/testing';
import { MarketDataController } from './market-data.controller';
import { PriceSyncService } from './price-sync.service';

describe('MarketDataController', () => {
  let controller: MarketDataController;
  const priceSyncService = {
    syncPrices: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [MarketDataController],
      providers: [{ provide: PriceSyncService, useValue: priceSyncService }],
    }).compile();
    controller = moduleRef.get(MarketDataController);
  });

  it('delegates sync-prices', async () => {
    const result = { processedSymbols: 0, upsertedBars: 0, failures: [] };
    priceSyncService.syncPrices.mockResolvedValue(result);

    await expect(
      controller.syncPrices({
        symbolIds: ['s1'],
        from: '2026-01-01',
        to: '2026-01-02',
      }),
    ).resolves.toEqual(result);
    expect(priceSyncService.syncPrices).toHaveBeenCalledWith({
      symbolIds: ['s1'],
      from: '2026-01-01',
      to: '2026-01-02',
    });
  });
});
