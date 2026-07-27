/**
 * NestJS アプリケーションのルートモジュール。
 *
 * Phase 3 ではヘルス・認証・Prisma・市場データ・ウォッチリスト・ポートフォリオ・
 * グローバル JWT Guard を登録する。ScheduleModule で日次価格同期 cron を有効化する。
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MarketDataModule } from './market-data/market-data.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { PrismaModule } from './prisma.module';
import { WatchlistsModule } from './watchlists/watchlists.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    MarketDataModule,
    WatchlistsModule,
    PortfoliosModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    // 全ルートを JWT 必須にし、@Public() のみ免除する
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
