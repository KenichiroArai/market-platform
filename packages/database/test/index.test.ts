const prismaClientCtor = jest.fn();

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation((config) => ({ config })),
}));

jest.mock('../generated/client', () => ({
  PrismaClient: function MockPrismaClient(this: unknown, options: unknown) {
    prismaClientCtor(options);
    return { options };
  },
  Prisma: {
    DbNull: 'DbNull',
    JsonNull: 'JsonNull',
  },
}));

import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, createPrismaClient } from '../src/index';

describe('createPrismaClient', () => {
  const originalUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalUrl;
    }
    jest.clearAllMocks();
  });

  it('throws when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL;
    expect(() => createPrismaClient()).toThrow('DATABASE_URL is not set');
  });

  it('creates a client with the provided connection string', () => {
    const client = createPrismaClient('postgresql://user:pass@localhost:5432/db');
    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: 'postgresql://user:pass@localhost:5432/db',
    });
    expect(prismaClientCtor).toHaveBeenCalledWith({
      adapter: { config: { connectionString: 'postgresql://user:pass@localhost:5432/db' } },
    });
    expect(client).toEqual({
      options: {
        adapter: { config: { connectionString: 'postgresql://user:pass@localhost:5432/db' } },
      },
    });
  });

  it('uses DATABASE_URL from the environment by default', () => {
    process.env.DATABASE_URL = 'postgresql://env/db';
    createPrismaClient();
    expect(PrismaPg).toHaveBeenCalledWith({ connectionString: 'postgresql://env/db' });
  });

  it('re-exports Prisma namespace for JSON null sentinels', () => {
    expect(Prisma.DbNull).toBe('DbNull');
    expect(Prisma.JsonNull).toBe('JsonNull');
  });
});
