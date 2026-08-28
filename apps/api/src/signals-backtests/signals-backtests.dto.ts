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
import type { BacktestSignalMode, SignalStrategyType } from '@market/shared-types';

/** シグナル定義 CRUD 用（トレンドスコア戦略はバックテスト実行専用のため含めない）。 */
const strategyTypes: SignalStrategyType[] = ['smaCross', 'rsiThreshold', 'macdCross'];

const signalModes: BacktestSignalMode[] = ['indicatorSet', 'trendScore'];

const allStrategyTypes: SignalStrategyType[] = [
  'smaCross',
  'rsiThreshold',
  'macdCross',
  'trendScoreThreshold',
];

/** GET/DELETE /backtests の検索クエリ。省略時 isActive=true（活動中のみ）。 */
export class BacktestRunSearchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  symbolId?: string;

  @ApiPropertyOptional({ enum: allStrategyTypes })
  @IsOptional()
  @IsIn(allStrategyTypes)
  strategyType?: SignalStrategyType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indicatorSetId?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: '検証期間フィルタ（overlap）' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: '検証期間フィルタ（overlap）' })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: '実行日時フィルタ（createdAt >=）' })
  @IsOptional()
  @IsString()
  createdFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: '実行日時フィルタ（createdAt <= 日末）' })
  @IsOptional()
  @IsString()
  createdTo?: string;

  @ApiPropertyOptional({
    description: '省略時 true。false=削除済みのみ。all=両方。',
    enum: ['true', 'false', 'all', '1', '0'],
  })
  @IsOptional()
  @IsString()
  isActive?: string;
}

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
  @ApiPropertyOptional({
    enum: signalModes,
    default: 'indicatorSet',
    description:
      'indicatorSet=指標セットから SMA/MACD/RSI を導出。trendScore=チャート同系トレンドスコア。',
  })
  @IsOptional()
  @IsIn(signalModes)
  signalMode?: BacktestSignalMode;

  @ApiPropertyOptional({
    description:
      '指標セット ID。signalMode=indicatorSet では必須。trendScore では結果チャート用に任意。',
  })
  @IsOptional()
  @IsString()
  indicatorSetId?: string;

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

  @ApiPropertyOptional({
    example: 37.5,
    description: 'trendScore 時の買い閾値。省略時は 37.5（上昇トレンド境界）。',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  buyThreshold?: number;

  @ApiPropertyOptional({
    example: -42.5,
    description: 'trendScore 時の売り閾値。省略時は -42.5（やや下向き境界）。',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sellThreshold?: number;
}

/** カタログ SMA ペア（25/75, 25/200, 75/200）のみを評価する。結果は永続化しない。 */
export class OptimizeBacktestDto {
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
