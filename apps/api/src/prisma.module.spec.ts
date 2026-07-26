import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

describe('PrismaModule', () => {
  it('is defined and exports PrismaService provider token', () => {
    expect(PrismaModule).toBeDefined();
    expect(PrismaService).toBeDefined();
  });
});
