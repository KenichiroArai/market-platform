import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuthController } from '../src/auth/auth.controller';
import { HealthController } from '../src/health.controller';
import { HealthService } from '../src/health.service';
import { IndicatorsController } from '../src/indicators/indicators.controller';
import { IndicatorSetsController } from '../src/indicator-sets/indicator-sets.controller';
import { MarketDataController } from '../src/market-data/market-data.controller';
import { MARKET_DATA_PROVIDER } from '../src/market-data/providers/provider.token';
import { StubMarketDataProvider } from '../src/market-data/providers/stub-market-data.provider';
import { YahooFinanceProvider } from '../src/market-data/providers/yahoo-finance.provider';
import { PortfoliosController } from '../src/portfolios/portfolios.controller';
import { PrismaService } from '../src/prisma.service';
import { SymbolsController } from '../src/symbols/symbols.controller';
import { WatchlistsController } from '../src/watchlists/watchlists.controller';

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

  it('wires health, auth, market-data, watchlists, portfolios, indicators, and indicator sets', async () => {
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
          dailyPrice: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn(), aggregate: jest.fn() },
          watchlist: { findMany: jest.fn(), findFirst: jest.fn() },
          watchlistItem: { findUnique: jest.fn(), findFirst: jest.fn() },
          portfolio: { findMany: jest.fn(), findFirst: jest.fn() },
          indicatorSet: { findMany: jest.fn(), findFirst: jest.fn() },
        },
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(YahooFinanceProvider)
      .useValue({ fetchDailyBars: jest.fn(), fetchQuote: jest.fn() })
      .compile();

    expect(moduleRef.get(HealthController)).toBeDefined();
    expect(moduleRef.get(HealthService)).toBeDefined();
    expect(moduleRef.get(PrismaService)).toBeDefined();
    expect(moduleRef.get(AuthController)).toBeDefined();
    expect(moduleRef.get(SymbolsController)).toBeDefined();
    expect(moduleRef.get(MarketDataController)).toBeDefined();
    expect(moduleRef.get(WatchlistsController)).toBeDefined();
    expect(moduleRef.get(PortfoliosController)).toBeDefined();
    expect(moduleRef.get(IndicatorsController)).toBeDefined();
    expect(moduleRef.get(IndicatorSetsController)).toBeDefined();
    expect(moduleRef.get(MARKET_DATA_PROVIDER)).toBeInstanceOf(StubMarketDataProvider);
  });
});
