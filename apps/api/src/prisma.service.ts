/**
 * Prisma へのアクセスを Nest の DI で共有するサービス。
 *
 * Client は遅延生成し、モジュール初期化時に接続を試みる。
 * 起動時に DB が落ちていても API 自体は起動させ、ヘルスチェックで degraded を返す。
 */
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@market/database';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  /** 未生成時は null。getter 経由で初めて createPrismaClient する。 */
  private client: PrismaClient | null = null;

  /**
   * 共有 PrismaClient。複数回アクセスしてもインスタンスは 1 つ。
   * 接続プール枯渇を避けるため、プロセス内で再利用する。
   */
  get prisma(): PrismaClient {
    if (!this.client) {
      this.client = createPrismaClient();
    }
    return this.client;
  }

  /**
   * 起動時の先行接続。失敗しても throw せず、後続の /health で再検知する。
   */
  async onModuleInit() {
    try {
      await this.prisma.$connect();
    } catch {
      // Connection is re-checked in health endpoints.
    }
  }

  /** プロセス終了時に接続を解放する。未生成なら何もしない。 */
  async onModuleDestroy() {
    if (this.client) {
      await this.client.$disconnect();
    }
  }
}
