import { PrismaModule } from '../src/prisma.module';
import { PrismaService } from '../src/prisma.service';

describe('PrismaModule', () => {
  it('is defined and exports PrismaService provider token', () => {
    expect(PrismaModule).toBeDefined();
    expect(PrismaService).toBeDefined();
  });
});
