import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { SignalStrategyType } from '@market/shared-types';

const strategyTypes: SignalStrategyType[] = ['smaCross', 'rsiThreshold', 'macdCross'];

export class CreateSignalDefinitionDto {
  @ApiProperty({ example: 'SMA 5/20' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '短期と長期のクロス' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: strategyTypes })
  @IsIn(strategyTypes)
  strategyType!: SignalStrategyType;

  @ApiProperty({ description: '戦略ごとのJSONパラメータ' })
  @IsObject()
  params!: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSignalDefinitionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RunBacktestDto {
  @ApiProperty()
  @IsString()
  signalDefinitionId!: string;

  @ApiProperty()
  @IsString()
  symbolId!: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsString()
  from!: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsString()
  to!: string;

  @ApiProperty({ example: 100000 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  initialCash!: number;

  @ApiProperty({ example: 0.001 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feeRate!: number;

  @ApiProperty({ example: 0.001 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  slippageRate!: number;
}
