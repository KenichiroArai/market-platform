import {
  API_ERROR_CODES,
  createApiErrorBody,
  createAuthTokenResponse,
  createDailyPriceDto,
  createHealthResponse,
  createPortfolioCurrencyTotalDto,
  createPortfolioDto,
  createPortfolioHoldingDto,
  createPriceSyncJobResult,
  createSymbolDto,
  createWatchlistDto,
  createWatchlistItemDto,
  isApiErrorBody,
  isAuthTokenResponse,
  isAuthUser,
  isDailyPriceDto,
  isHealthStatus,
  isMarket,
  isPortfolioCurrencyTotalDto,
  isPortfolioDto,
  isPortfolioHoldingDto,
  isPriceSyncJobResult,
  isSymbolDto,
  isWatchlistDto,
  isWatchlistItemDto,
} from './index';

describe('shared-types health', () => {
  it('accepts valid health statuses', () => {
    expect(isHealthStatus('ok')).toBe(true);
    expect(isHealthStatus('degraded')).toBe(true);
    expect(isHealthStatus('error')).toBe(true);
  });

  it('rejects invalid health statuses', () => {
    expect(isHealthStatus('healthy')).toBe(false);
    expect(isHealthStatus(1)).toBe(false);
    expect(isHealthStatus(null)).toBe(false);
  });

  it('creates a response without details', () => {
    expect(createHealthResponse('ok', 'api')).toEqual({
      status: 'ok',
      service: 'api',
    });
  });

  it('creates a response with details', () => {
    expect(createHealthResponse('degraded', 'api', { database: 'down' })).toEqual({
      status: 'degraded',
      service: 'api',
      details: { database: 'down' },
    });
  });
});

describe('shared-types errors', () => {
  it('exposes stable error codes', () => {
    expect(API_ERROR_CODES.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    expect(API_ERROR_CODES.AUTH_UNAUTHORIZED).toBe('AUTH_UNAUTHORIZED');
    expect(API_ERROR_CODES.AUTH_INVALID_CREDENTIALS).toBe('AUTH_INVALID_CREDENTIALS');
    expect(API_ERROR_CODES.AUTH_EMAIL_TAKEN).toBe('AUTH_EMAIL_TAKEN');
    expect(API_ERROR_CODES.SYMBOL_NOT_FOUND).toBe('SYMBOL_NOT_FOUND');
    expect(API_ERROR_CODES.SYMBOL_ALREADY_EXISTS).toBe('SYMBOL_ALREADY_EXISTS');
    expect(API_ERROR_CODES.WATCHLIST_NOT_FOUND).toBe('WATCHLIST_NOT_FOUND');
    expect(API_ERROR_CODES.WATCHLIST_ITEM_NOT_FOUND).toBe('WATCHLIST_ITEM_NOT_FOUND');
    expect(API_ERROR_CODES.WATCHLIST_ITEM_ALREADY_EXISTS).toBe('WATCHLIST_ITEM_ALREADY_EXISTS');
    expect(API_ERROR_CODES.PORTFOLIO_NOT_FOUND).toBe('PORTFOLIO_NOT_FOUND');
    expect(API_ERROR_CODES.HOLDING_NOT_FOUND).toBe('HOLDING_NOT_FOUND');
    expect(API_ERROR_CODES.HOLDING_ALREADY_EXISTS).toBe('HOLDING_ALREADY_EXISTS');
    expect(API_ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
  });

  it('creates an error body with optional fields omitted', () => {
    const body = createApiErrorBody({
      statusCode: 400,
      code: API_ERROR_CODES.VALIDATION_FAILED,
      message: 'invalid',
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    expect(body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'invalid',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('creates an error body with details and path', () => {
    const body = createApiErrorBody({
      statusCode: 401,
      code: API_ERROR_CODES.AUTH_UNAUTHORIZED,
      message: 'unauthorized',
      details: { reason: 'missing' },
      path: '/auth/me',
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    expect(body.details).toEqual({ reason: 'missing' });
    expect(body.path).toBe('/auth/me');
  });

  it('defaults timestamp when omitted', () => {
    const before = Date.now();
    const body = createApiErrorBody({
      statusCode: 500,
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'boom',
    });
    const after = Date.now();

    expect(Date.parse(body.timestamp)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(body.timestamp)).toBeLessThanOrEqual(after);
  });

  it('validates ApiErrorBody shape', () => {
    expect(
      isApiErrorBody({
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'bad',
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(true);
    expect(isApiErrorBody(null)).toBe(false);
    expect(isApiErrorBody({})).toBe(false);
    expect(isApiErrorBody({ statusCode: 'x', code: 'a', message: 'b', timestamp: 'c' })).toBe(
      false,
    );
  });
});

describe('shared-types auth', () => {
  const user = { id: 'user_1', email: 'a@example.com' };

  it('creates a token response', () => {
    expect(createAuthTokenResponse('token', user)).toEqual({
      accessToken: 'token',
      tokenType: 'Bearer',
      user,
    });
  });

  it('validates AuthUser', () => {
    expect(isAuthUser(user)).toBe(true);
    expect(isAuthUser(null)).toBe(false);
    expect(isAuthUser({ id: 1, email: 'a' })).toBe(false);
  });

  it('validates AuthTokenResponse', () => {
    expect(isAuthTokenResponse(createAuthTokenResponse('token', user))).toBe(true);
    expect(isAuthTokenResponse({ accessToken: 't', tokenType: 'Basic', user })).toBe(false);
    expect(isAuthTokenResponse(null)).toBe(false);
    expect(isAuthTokenResponse({ accessToken: 1, tokenType: 'Bearer', user })).toBe(false);
  });
});

describe('shared-types market', () => {
  const symbol = {
    id: 'sym_1',
    ticker: 'AAPL',
    market: 'US' as const,
    name: 'Apple Inc.',
    currency: 'USD',
    exchange: 'NASDAQ',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const price = {
    id: 'px_1',
    symbolId: 'sym_1',
    date: '2026-01-02',
    open: 100,
    high: 110,
    low: 95,
    close: 105,
    volume: 1_000_000,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  it('validates Market', () => {
    expect(isMarket('US')).toBe(true);
    expect(isMarket('JP')).toBe(true);
    expect(isMarket('EU')).toBe(false);
  });

  it('creates and validates SymbolDto', () => {
    expect(createSymbolDto(symbol)).toEqual(symbol);
    expect(isSymbolDto(symbol)).toBe(true);
    expect(isSymbolDto({ ...symbol, exchange: null })).toBe(true);
    expect(isSymbolDto(null)).toBe(false);
    expect(isSymbolDto({ ...symbol, market: 'EU' })).toBe(false);
  });

  it('creates and validates DailyPriceDto', () => {
    expect(createDailyPriceDto(price)).toEqual(price);
    expect(isDailyPriceDto(price)).toBe(true);
    expect(isDailyPriceDto(null)).toBe(false);
    expect(isDailyPriceDto({ ...price, open: 'x' })).toBe(false);
  });

  it('creates and validates PriceSyncJobResult', () => {
    const result = createPriceSyncJobResult(2, 10, [
      { symbolId: 'sym_2', ticker: 'MSFT', reason: 'timeout' },
    ]);
    expect(result.processedSymbols).toBe(2);
    expect(result.upsertedBars).toBe(10);
    expect(isPriceSyncJobResult(result)).toBe(true);
    expect(createPriceSyncJobResult(0, 0)).toEqual({
      processedSymbols: 0,
      upsertedBars: 0,
      failures: [],
    });
    expect(isPriceSyncJobResult(null)).toBe(false);
    expect(isPriceSyncJobResult({ processedSymbols: 1, upsertedBars: 1, failures: 'x' })).toBe(
      false,
    );
    expect(
      isPriceSyncJobResult({
        processedSymbols: 1,
        upsertedBars: 1,
        failures: [{ symbolId: 1, ticker: 'A', reason: 'x' }],
      }),
    ).toBe(false);
    expect(
      isPriceSyncJobResult({
        processedSymbols: 1,
        upsertedBars: 1,
        failures: [null],
      }),
    ).toBe(false);
  });
});

describe('shared-types watchlist', () => {
  const symbol = {
    id: 'sym_1',
    ticker: 'AAPL',
    market: 'US' as const,
    name: 'Apple Inc.',
    currency: 'USD',
    exchange: 'NASDAQ',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const item = {
    id: 'item_1',
    watchlistId: 'wl_1',
    symbolId: 'sym_1',
    symbol,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const watchlist = {
    id: 'wl_1',
    userId: 'user_1',
    name: 'Tech',
    items: [item],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('creates and validates WatchlistItemDto', () => {
    expect(createWatchlistItemDto(item)).toEqual(item);
    expect(isWatchlistItemDto(item)).toBe(true);
    expect(isWatchlistItemDto(null)).toBe(false);
    expect(isWatchlistItemDto({ ...item, symbolId: 1 })).toBe(false);
  });

  it('creates and validates WatchlistDto', () => {
    expect(createWatchlistDto(watchlist)).toEqual(watchlist);
    expect(isWatchlistDto(watchlist)).toBe(true);
    expect(isWatchlistDto({ ...watchlist, items: [] })).toBe(true);
    expect(isWatchlistDto(null)).toBe(false);
    expect(isWatchlistDto({ ...watchlist, items: [null] })).toBe(false);
    expect(isWatchlistDto({ ...watchlist, name: 1 })).toBe(false);
  });
});

describe('shared-types portfolio', () => {
  const symbol = {
    id: 'sym_1',
    ticker: 'AAPL',
    market: 'US' as const,
    name: 'Apple Inc.',
    currency: 'USD',
    exchange: 'NASDAQ',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const holding = {
    id: 'h_1',
    portfolioId: 'pf_1',
    symbolId: 'sym_1',
    symbol,
    quantity: 10,
    averageCost: 100,
    costBasis: 1000,
    marketPrice: 110,
    marketValue: 1100,
    unrealizedPnl: 100,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const total = {
    currency: 'USD',
    totalCost: 1000,
    totalMarketValue: 1100,
    unrealizedPnl: 100,
  };

  const portfolio = {
    id: 'pf_1',
    userId: 'user_1',
    name: 'Core',
    holdings: [holding],
    totalsByCurrency: [total],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('creates and validates currency totals', () => {
    expect(createPortfolioCurrencyTotalDto(total)).toEqual(total);
    expect(isPortfolioCurrencyTotalDto(total)).toBe(true);
    expect(isPortfolioCurrencyTotalDto(null)).toBe(false);
    expect(isPortfolioCurrencyTotalDto({ ...total, currency: 1 })).toBe(false);
  });

  it('creates and validates PortfolioHoldingDto', () => {
    expect(createPortfolioHoldingDto(holding)).toEqual(holding);
    expect(isPortfolioHoldingDto(holding)).toBe(true);
    expect(
      isPortfolioHoldingDto({
        ...holding,
        marketPrice: null,
        marketValue: null,
        unrealizedPnl: null,
      }),
    ).toBe(true);
    expect(isPortfolioHoldingDto(null)).toBe(false);
    expect(isPortfolioHoldingDto({ ...holding, quantity: 'x' })).toBe(false);
  });

  it('creates and validates PortfolioDto', () => {
    expect(createPortfolioDto(portfolio)).toEqual(portfolio);
    expect(isPortfolioDto(portfolio)).toBe(true);
    expect(isPortfolioDto({ ...portfolio, holdings: [], totalsByCurrency: [] })).toBe(true);
    expect(isPortfolioDto(null)).toBe(false);
    expect(isPortfolioDto({ ...portfolio, holdings: [null] })).toBe(false);
    expect(isPortfolioDto({ ...portfolio, totalsByCurrency: [null] })).toBe(false);
    expect(isPortfolioDto({ ...portfolio, name: 1 })).toBe(false);
  });
});
