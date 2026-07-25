/**
 * NestJS アプリケーションのルートモジュール。
 *
 * Phase 0 ではヘルスチェックに必要な Controller / Service / Prisma だけを登録する。
 * ドメイン機能は後続 Phase でモジュール分割して追加する。
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, PrismaService],
})
export class AppModule {}
