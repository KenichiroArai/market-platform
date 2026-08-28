/**
 * 指標セットのリクエスト DTO。
 *
 * class-validator で検証し、ValidationPipe 経由で共通エラー形式に落とす。
 * カタログ ID の可否（未知・エリオット）は Service 側で判定する。
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateIndicatorSetDto {
  @ApiProperty({ example: 'スイング' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: ['sma25', 'rsi', 'volume'] })
  @IsArray()
  @IsString({ each: true })
  indicatorIds!: string[];

  @ApiPropertyOptional({ example: { sma25: { period: 30 } } })
  @IsOptional()
  @IsObject()
  indicatorParams?: Record<string, Record<string, number>>;

  @ApiPropertyOptional({ example: { trend: 40, momentum: 20, oscillator: 10, volatility: 10, volume: 10, cycle: 10 } })
  @IsOptional()
  @IsObject()
  groupWeights?: Record<string, number> | null;

  @ApiPropertyOptional({ example: 37.5 })
  @IsOptional()
  @IsNumber()
  buyThreshold?: number | null;

  @ApiPropertyOptional({ example: -42.5 })
  @IsOptional()
  @IsNumber()
  sellThreshold?: number | null;
}

export class UpdateIndicatorSetDto {
  @ApiPropertyOptional({ example: 'スイング改' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: ['sma25', 'rsi'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  indicatorIds?: string[];

  @ApiPropertyOptional({ example: { sma25: { period: 30 } } })
  @IsOptional()
  @IsObject()
  indicatorParams?: Record<string, Record<string, number>>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  groupWeights?: Record<string, number> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  buyThreshold?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sellThreshold?: number | null;
}
