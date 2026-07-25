jest.mock('@market/database', () => ({
  createPrismaClient: jest.fn(),
}));

import { createPrismaClient } from '@market/database';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const createPrismaClientMock = createPrismaClient as jest.Mock;
  let service: PrismaService;
  const client = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    createPrismaClientMock.mockReturnValue(client);
    service = new PrismaService();
  });

  it('lazily creates a prisma client', () => {
    expect(service.prisma).toBe(client);
    expect(service.prisma).toBe(client);
    expect(createPrismaClientMock).toHaveBeenCalledTimes(1);
  });

  it('connects on module init', async () => {
    client.$connect.mockResolvedValue(undefined);
    await service.onModuleInit();
    expect(client.$connect).toHaveBeenCalledTimes(1);
  });

  it('ignores connection errors on module init', async () => {
    client.$connect.mockRejectedValue(new Error('unavailable'));
    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('disconnects existing client on destroy', async () => {
    void service.prisma;
    client.$disconnect.mockResolvedValue(undefined);
    await service.onModuleDestroy();
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('skips disconnect when client was never created', async () => {
    await service.onModuleDestroy();
    expect(client.$disconnect).not.toHaveBeenCalled();
  });
});
