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
}
