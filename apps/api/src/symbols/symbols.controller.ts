/**
 * 銘柄マスタ HTTP エンドポイント。
 *
 * 読み書きとも JWT 必須（グローバル Guard）。価格一覧はネストルートで提供する。
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { DailyPriceDto, SymbolDto } from '@market/shared-types';
import { PricesService } from '../prices/prices.service';
import { CreateSymbolDto, UpdateSymbolDto } from './symbols.dto';
import { SymbolsService } from './symbols.service';

@ApiTags('symbols')
@ApiBearerAuth()
@Controller('symbols')
export class SymbolsController {
  constructor(
    private readonly symbolsService: SymbolsService,
    private readonly pricesService: PricesService,
  ) {}

  /** 銘柄一覧。 */
  @Get()
  @ApiQuery({ name: 'market', required: false, enum: ['US', 'JP'] })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiOkResponse({ description: 'Symbol list' })
  list(
    @Query('market') market?: 'US' | 'JP',
    @Query('isActive') isActive?: string,
  ): Promise<SymbolDto[]> {
    return this.symbolsService.list({
      market,
      isActive:
        isActive === undefined
          ? undefined
          : isActive === 'true' || isActive === '1',
    });
  }

  /** 銘柄 1 件。 */
  @Get(':id')
  @ApiOkResponse({ description: 'Symbol detail' })
  getById(@Param('id') id: string): Promise<SymbolDto> {
    return this.symbolsService.getById(id);
  }

  /** 銘柄の価格一覧（日足または週足）。 */
  @Get(':id/prices')
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-01-31' })
  @ApiQuery({
    name: 'interval',
    required: false,
    enum: ['1d', '1w'],
    description: '足種。省略時は 1d。1w は日足から集約',
  })
  @ApiOkResponse({ description: 'Prices for symbol (daily or weekly)' })
  listPrices(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('interval') interval?: '1d' | '1w',
  ): Promise<DailyPriceDto[]> {
    return this.pricesService.listBySymbolId(id, {
      from,
      to,
      interval: interval === '1w' ? '1w' : '1d',
    });
  }

  /** 銘柄作成。ティッカーと市場だけ受け、メタデータは quote で補完する。 */
  @Post()
  @ApiOkResponse({ description: 'Created symbol' })
  create(@Body() dto: CreateSymbolDto): Promise<SymbolDto> {
    return this.symbolsService.create(dto);
  }

  /** 銘柄部分更新。 */
  @Patch(':id')
  @ApiOkResponse({ description: 'Updated symbol' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSymbolDto,
  ): Promise<SymbolDto> {
    return this.symbolsService.update(id, dto);
  }
}
