/**
 * Prisma モジュール。
 *
 * PrismaService を Auth など複数モジュールから注入できるように export する。
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
