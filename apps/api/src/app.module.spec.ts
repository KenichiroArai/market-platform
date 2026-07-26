import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AuthController } from './auth/auth.controller';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from './prisma.service';

describe('AppModule', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('wires health and auth controllers and providers', async () => {
    process.env.JWT_SECRET = 'test-secret-for-app-module';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        prisma: { $queryRaw: jest.fn(), user: { findUnique: jest.fn() } },
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    expect(moduleRef.get(HealthController)).toBeDefined();
    expect(moduleRef.get(HealthService)).toBeDefined();
    expect(moduleRef.get(PrismaService)).toBeDefined();
    expect(moduleRef.get(AuthController)).toBeDefined();
  });
});
