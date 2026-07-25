import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createPrismaClient, PrismaClient } from '@market/database';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private client: PrismaClient | null = null;

  get prisma(): PrismaClient {
    if (!this.client) {
      this.client = createPrismaClient();
    }
    return this.client;
  }

  async onModuleInit() {
    try {
      await this.prisma.$connect();
    } catch {
      // Connection is re-checked in health endpoints.
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.$disconnect();
    }
  }
}
