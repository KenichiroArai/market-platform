/**
 * 価格同期ジョブのリクエスト DTO。
 *
 * 省略時はアクティブ全銘柄・直近 N 日（MARKET_DATA_LOOKBACK_DAYS）。
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class SyncPricesDto {
  @ApiPropertyOptional({
    type: [String],
    description: '対象銘柄 ID。省略時は isActive=true の全銘柄',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbolIds?: string[];

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY)
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY)
  to?: string;

  @ApiPropertyOptional({
    description: 'true のとき要求期間全体を再取得して上書きする（既定 true）',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}
