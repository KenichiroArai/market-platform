/**
 * テクニカル指標のクエリ DTO。
 *
 * GET のため class-validator で文字列を検証する。
 * 期間パラメータはカタログ既定に一本化した（ADR 006）。
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetIndicatorsQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: '開始日 YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: '終了日 YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    example: '1d',
    enum: ['1d', '1w'],
    description: '足種。省略時は 1d。1w は日足から集約してから指標計算',
  })
  @IsOptional()
  @IsString()
  @IsIn(['1d', '1w'])
  interval?: '1d' | '1w';

  @ApiPropertyOptional({
    example: 'sma25,sma75,sma200,macd,rsi,bb,obv,ichimoku',
    description: 'カタログ ID のカンマ区切り。省略時はおすすめ構成',
  })
  @IsOptional()
  @IsString()
  indicators?: string;

  @ApiPropertyOptional({
    example: '{"sma25":{"period":30}}',
    description: '指標パラメータ上書き JSON',
  })
  @IsOptional()
  @IsString()
  indicatorParams?: string;
}

export class GetTrendScoreQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: '開始日 YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: '終了日 YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    example: '1d',
    enum: ['1d', '1w'],
    description: '足種。省略時は 1d。1w は日足から集約してからスコア計算',
  })
  @IsOptional()
  @IsString()
  @IsIn(['1d', '1w'])
  interval?: '1d' | '1w';

  @ApiPropertyOptional({
    example: '{"trend":40,"momentum":20,"oscillator":10,"volatility":10,"volume":10,"cycle":10}',
    description: '6 グループ配点 JSON。合計 100 必須',
  })
  @IsOptional()
  @IsString()
  groupWeights?: string;

  @ApiPropertyOptional({
    example: '{"sma25":{"period":30}}',
    description: '指標パラメータ上書き JSON',
  })
  @IsOptional()
  @IsString()
  indicatorParams?: string;
}

export class GetEntryAdviceQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ example: '1d', enum: ['1d', '1w'] })
  @IsOptional()
  @IsString()
  @IsIn(['1d', '1w'])
  interval?: '1d' | '1w';

  @ApiPropertyOptional({ description: 'カタログ ID のカンマ区切り' })
  @IsOptional()
  @IsString()
  indicators?: string;

  @ApiPropertyOptional({ description: '指標パラメータ上書き JSON' })
  @IsOptional()
  @IsString()
  indicatorParams?: string;

  @ApiPropertyOptional({ description: '6 グループ配点 JSON' })
  @IsOptional()
  @IsString()
  groupWeights?: string;

  @ApiPropertyOptional({ example: '37.5' })
  @IsOptional()
  @IsString()
  buyThreshold?: string;

  @ApiPropertyOptional({ example: '-42.5' })
  @IsOptional()
  @IsString()
  sellThreshold?: string;

  @ApiPropertyOptional({ example: '2026-06-15' })
  @IsOptional()
  @IsString()
  baseDate?: string;

  @ApiPropertyOptional({ example: '100000' })
  @IsOptional()
  @IsString()
  initialCash?: string;

  @ApiPropertyOptional({ example: 'longOnly', enum: ['longOnly', 'longShort'] })
  @IsOptional()
  @IsString()
  @IsIn(['longOnly', 'longShort'])
  tradeSidePolicy?: 'longOnly' | 'longShort';

  @ApiPropertyOptional({ description: '資金管理設定 JSON' })
  @IsOptional()
  @IsString()
  moneyManagement?: string;
}
