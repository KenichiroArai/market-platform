/**
 * テクニカル指標 HTTP エンドポイント。
 *
 * 公開面は Nest のみ。実計算は IndicatorsService → FastAPI。
 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { IndicatorsResponseDto } from '@market/shared-types';
import { GetIndicatorsQueryDto } from './indicators.dto';
import { IndicatorsService } from './indicators.service';

@ApiTags('indicators')
@ApiBearerAuth()
@Controller('symbols')
export class IndicatorsController {
  constructor(private readonly indicatorsService: IndicatorsService) {}

  /** 銘柄のテクニカル指標（SMA/EMA/RSI/MACD）。 */
  @Get(':symbolId/indicators')
  @ApiOkResponse({ description: 'Technical indicators for symbol' })
  getIndicators(
    @Param('symbolId') symbolId: string,
    @Query() query: GetIndicatorsQueryDto,
  ): Promise<IndicatorsResponseDto> {
    return this.indicatorsService.getForSymbol(symbolId, query);
  }
}
