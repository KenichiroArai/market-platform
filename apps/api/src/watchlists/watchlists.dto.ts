/**
 * ウォッチリストのリクエスト DTO。
 *
 * class-validator で検証し、ValidationPipe 経由で共通エラー形式に落とす。
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWatchlistDto {
  @ApiProperty({ example: 'Tech' })
  @IsString()
  @MinLength(1)
  name!: string;
}

export class UpdateWatchlistDto {
  @ApiPropertyOptional({ example: 'Growth' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

export class AddWatchlistItemDto {
  @ApiProperty({ example: 'sym_cuid' })
  @IsString()
  @MinLength(1)
  symbolId!: string;
}
