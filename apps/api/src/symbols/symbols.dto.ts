/**
 * 銘柄マスタのリクエスト DTO。
 *
 * class-validator で検証し、ValidationPipe 経由で共通エラー形式に落とす。
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateSymbolDto {
  @ApiProperty({ example: 'AAPL' })
  @IsString()
  @MinLength(1)
  ticker!: string;

  @ApiProperty({ enum: ['US', 'JP'], example: 'US' })
  @IsIn(['US', 'JP'])
  market!: 'US' | 'JP';

  @ApiProperty({ example: 'Apple Inc.' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @MinLength(1)
  currency!: string;

  @ApiPropertyOptional({ example: 'NASDAQ', nullable: true })
  @IsOptional()
  @IsString()
  exchange?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSymbolDto {
  @ApiPropertyOptional({ example: 'Apple Inc.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  currency?: string;

  @ApiPropertyOptional({ example: 'NASDAQ', nullable: true })
  @IsOptional()
  @IsString()
  exchange?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
