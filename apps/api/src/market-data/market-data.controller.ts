/**
 * 市場データジョブの HTTP エンドポイント。
 *
 * 手動トリガで価格同期を実行する。定期実行は MarketDataScheduler が担う。
 */
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { PriceSyncJobResult } from '@market/shared-types';
import { SyncPricesDto } from './market-data.dto';
import { PriceSyncService } from './price-sync.service';

@ApiTags('market-data')
@ApiBearerAuth()
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly priceSyncService: PriceSyncService) {}

  /** 価格同期ジョブを手動実行する。 */
  @Post('jobs/sync-prices')
  @ApiOkResponse({ description: 'Price sync job result' })
  syncPrices(@Body() dto: SyncPricesDto): Promise<PriceSyncJobResult> {
    return this.priceSyncService.syncPrices({
      symbolIds: dto.symbolIds,
      from: dto.from,
      to: dto.to,
    });
  }
}
