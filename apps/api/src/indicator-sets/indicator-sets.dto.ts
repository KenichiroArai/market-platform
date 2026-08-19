/**
 * 指標セットのリクエスト DTO。
 *
 * class-validator で検証し、ValidationPipe 経由で共通エラー形式に落とす。
 * カタログ ID の可否（未知・エリオット）は Service 側で判定する。
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, MinLength } from 'class-validator';

export class CreateIndicatorSetDto {
  @ApiProperty({ example: 'スイング' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: ['sma25', 'rsi', 'volume'] })
  @IsArray()
  @IsString({ each: true })
  indicatorIds!: string[];
}
