import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client';

export type { PrismaClient } from '../generated/client';

export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
