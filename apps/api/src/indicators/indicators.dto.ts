/**
 * テクニカル指標のクエリ DTO。
 *
 * GET のため class-validator で数値・文字列を検証する。
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

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
    example: 'sma,ema,rsi,macd',
    description: 'カンマ区切り。省略時は全指標',
  })
  @IsOptional()
  @IsString()
  indicators?: string;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  smaPeriod?: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  emaPeriod?: number;

  @ApiPropertyOptional({ example: 14, default: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rsiPeriod?: number;

  @ApiPropertyOptional({ example: 12, default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  macdFast?: number;

  @ApiPropertyOptional({ example: 26, default: 26 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  macdSlow?: number;

  @ApiPropertyOptional({ example: 9, default: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  macdSignal?: number;
}
