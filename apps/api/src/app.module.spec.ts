import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AuthController } from './auth/auth.controller';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MarketDataController } from './market-data/market-data.controller';
import { MARKET_DATA_PROVIDER } from './market-data/providers/provider.token';
import { StubMarketDataProvider } from './market-data/providers/stub-market-data.provider';
import { YahooFinanceProvider } from './market-data/providers/yahoo-finance.provider';
import { PortfoliosController } from './portfolios/portfolios.controller';
import { PrismaService } from './prisma.service';
import { SymbolsController } from './symbols/symbols.controller';
import { WatchlistsController } from './watchlists/watchlists.controller';

describe('AppModule', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalProvider = process.env.MARKET_DATA_PROVIDER;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
    if (originalProvider === undefined) {
      delete process.env.MARKET_DATA_PROVIDER;
    } else {
      process.env.MARKET_DATA_PROVIDER = originalProvider;
    }
  });

  it('wires health, auth, market-data, watchlists, and portfolios', async () => {
    process.env.JWT_SECRET = 'test-secret-for-app-module';
    process.env.MARKET_DATA_PROVIDER = 'stub';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        prisma: {
          $queryRaw: jest.fn(),
          user: { findUnique: jest.fn() },
          symbol: { findMany: jest.fn(), findUnique: jest.fn() },
          dailyPrice: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
          watchlist: { findMany: jest.fn(), findFirst: jest.fn() },
          watchlistItem: { findUnique: jest.fn(), findFirst: jest.fn() },
          portfolio: { findMany: jest.fn(), findFirst: jest.fn() },
          portfolioHolding: { findUnique: jest.fn(), findFirst: jest.fn() },
        },
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(YahooFinanceProvider)
      .useValue({ fetchDailyBars: jest.fn() })
      .compile();

    expect(moduleRef.get(HealthController)).toBeDefined();
    expect(moduleRef.get(HealthService)).toBeDefined();
    expect(moduleRef.get(PrismaService)).toBeDefined();
    expect(moduleRef.get(AuthController)).toBeDefined();
    expect(moduleRef.get(SymbolsController)).toBeDefined();
    expect(moduleRef.get(MarketDataController)).toBeDefined();
    expect(moduleRef.get(WatchlistsController)).toBeDefined();
    expect(moduleRef.get(PortfoliosController)).toBeDefined();
    expect(moduleRef.get(MARKET_DATA_PROVIDER)).toBeInstanceOf(StubMarketDataProvider);
  });
});
