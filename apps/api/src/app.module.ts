/**
 * NestJS アプリケーションのルートモジュール。
 *
 * Phase 1 ではヘルス・認証・Prisma・グローバル JWT Guard を登録する。
 * ドメイン機能は後続 Phase でモジュール分割して追加する。
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    // 全ルートを JWT 必須にし、@Public() のみ免除する
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
