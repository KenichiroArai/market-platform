/**
 * 指標セットモジュール。
 */
import { Module } from '@nestjs/common';
import { IndicatorSetsController } from './indicator-sets.controller';
import { IndicatorSetsService } from './indicator-sets.service';

@Module({
  controllers: [IndicatorSetsController],
  providers: [IndicatorSetsService],
  exports: [IndicatorSetsService],
})
export class IndicatorSetsModule {}
