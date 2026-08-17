/**
 * テクニカル指標 HTTP エンドポイント。
 *
 * 公開面は Nest のみ。実計算は IndicatorsService → FastAPI。
 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { IndicatorsResponseDto, TrendScoreResponseDto } from '@market/shared-types';
import { GetIndicatorsQueryDto, GetTrendScoreQueryDto } from './indicators.dto';
import { IndicatorsService } from './indicators.service';

@ApiTags('indicators')
@ApiBearerAuth()
@Controller('symbols')
export class IndicatorsController {
  constructor(private readonly indicatorsService: IndicatorsService) {}

  /** 銘柄のテクニカル指標（カタログ ID。ADR 006）。 */
  @Get(':symbolId/indicators')
  @ApiOkResponse({ description: 'Technical indicators for symbol' })
  getIndicators(
    @Param('symbolId') symbolId: string,
    @Query() query: GetIndicatorsQueryDto,
  ): Promise<IndicatorsResponseDto> {
    return this.indicatorsService.getForSymbol(symbolId, query);
  }

  /** 銘柄のトレンドスコア（ADR 007）。チャート背景用。 */
  @Get(':symbolId/trend-score')
  @ApiOkResponse({ description: 'Trend score series for symbol' })
  getTrendScore(
    @Param('symbolId') symbolId: string,
    @Query() query: GetTrendScoreQueryDto,
  ): Promise<TrendScoreResponseDto> {
    return this.indicatorsService.getTrendScoreForSymbol(symbolId, query);
  }
}
