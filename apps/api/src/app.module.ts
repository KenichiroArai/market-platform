/**
 * NestJS アプリケーションのルートモジュール。
 *
 * Phase 4 ではヘルス・認証・Prisma・市場データ・ウォッチリスト・ポートフォリオ・
 * テクニカル指標ゲートウェイ・指標セット・グローバル JWT Guard を登録する。
 * ScheduleModule で日次価格同期 cron を有効化する。
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { IndicatorsModule } from './indicators/indicators.module';
import { IndicatorSetsModule } from './indicator-sets/indicator-sets.module';
import { MarketDataModule } from './market-data/market-data.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { PrismaModule } from './prisma.module';
import { SignalsBacktestsModule } from './signals-backtests/signals-backtests.module';
import { WatchlistsModule } from './watchlists/watchlists.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    MarketDataModule,
    WatchlistsModule,
    PortfoliosModule,
    IndicatorsModule,
    IndicatorSetsModule,
    SignalsBacktestsModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    // 全ルートを JWT 必須にし、@Public() のみ免除する
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
