/**
 * ポートフォリオのリクエスト DTO。
 *
 * class-validator で検証し、ValidationPipe 経由で共通エラー形式に落とす。
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreatePortfolioDto {
  @ApiProperty({ example: 'Core' })
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdatePortfolioDto {
  @ApiPropertyOptional({ example: 'Satellite' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

export class AddPortfolioHoldingDto {
  @ApiProperty({ example: 'sym_cuid' })
  @IsString()
  @MinLength(1)
  symbolId!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiProperty({ example: 150.25 })
  @IsNumber()
  @Min(0)
  averageCost!: number;
}

export class UpdatePortfolioHoldingDto {
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 148.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  averageCost?: number;
}
