/**
 * 銘柄マスタのリクエスト DTO。
 *
 * class-validator で検証し、ValidationPipe 経由で共通エラー形式に落とす。
 * 作成時はティッカーと市場だけ受け、名称等は quote で補完する。
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
