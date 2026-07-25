import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from './prisma.service';

describe('AppModule', () => {
  it('wires health controller and providers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        prisma: { $queryRaw: jest.fn() },
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    expect(moduleRef.get(HealthController)).toBeDefined();
    expect(moduleRef.get(HealthService)).toBeDefined();
    expect(moduleRef.get(PrismaService)).toBeDefined();
  });
});
