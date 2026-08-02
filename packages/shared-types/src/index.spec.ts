import {
  API_ERROR_CODES,
  computeIndicatorLookback,
  createApiErrorBody,
  createAuthTokenResponse,
  createDailyPriceDto,
  createHealthResponse,
  createIndicatorsResponseDto,
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
  isIndicatorRequestSpec,
  isIndicatorSeriesPoint,
  isIndicatorType,
  isIndicatorsResponseDto,
  isMarket,
  isPortfolioCurrencyTotalDto,
  isPortfolioDto,
  isPortfolioHoldingDto,
  isPriceSyncJobResult,
  isSymbolDto,
  isBacktestRunDto,
  isSignalDefinitionDto,
  isSignalStrategyType,
  isWatchlistDto,
  isWatchlistItemDto,
  isChartInterval,
  aggregateDailyBarsToWeekly,
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
    expect(API_ERROR_CODES.INSUFFICIENT_PRICE_DATA).toBe('INSUFFICIENT_PRICE_DATA');
    expect(API_ERROR_CODES.ANALYSIS_UPSTREAM_ERROR).toBe('ANALYSIS_UPSTREAM_ERROR');
    expect(API_ERROR_CODES.SIGNAL_DEFINITION_NOT_FOUND).toBe('SIGNAL_DEFINITION_NOT_FOUND');
    expect(API_ERROR_CODES.SIGNAL_DEFINITION_ALREADY_EXISTS).toBe('SIGNAL_DEFINITION_ALREADY_EXISTS');
    expect(API_ERROR_CODES.BACKTEST_RUN_NOT_FOUND).toBe('BACKTEST_RUN_NOT_FOUND');
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

describe('shared-types signals', () => {
  const signal = {
    id: 'sig_1',
    userId: 'u_1',
    name: 'SMA',
    strategyType: 'smaCross' as const,
    params: { shortPeriod: 5, longPeriod: 20 },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const run = {
    id: 'run_1',
    userId: 'u_1',
    signalDefinitionId: 'sig_1',
    symbolId: 'sym_1',
    fromDate: '2026-01-01',
    toDate: '2026-06-30',
    initialCash: 100000,
    feeRate: 0.001,
    slippageRate: 0.001,
    summary: {
      finalEquity: 110000,
      totalReturnRate: 0.1,
      maxDrawdownRate: 0.05,
      totalTrades: 5,
      winRate: 0.6,
    },
    trades: [],
    equityPoints: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('validates strategy types', () => {
    expect(isSignalStrategyType('smaCross')).toBe(true);
    expect(isSignalStrategyType('rsiThreshold')).toBe(true);
    expect(isSignalStrategyType('macdCross')).toBe(true);
    expect(isSignalStrategyType('other')).toBe(false);
  });

  it('validates SignalDefinitionDto and BacktestRunDto', () => {
    expect(isSignalDefinitionDto(signal)).toBe(true);
    expect(isBacktestRunDto(run)).toBe(true);
    expect(isSignalDefinitionDto(null)).toBe(false);
    expect(isBacktestRunDto(null)).toBe(false);
    expect(isSignalDefinitionDto({ ...signal, strategyType: 'invalid' })).toBe(false);
    expect(isBacktestRunDto({ ...run, summary: null })).toBe(false);
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

describe('shared-types analysis', () => {
  const specs = [
    { type: 'sma' as const, period: 20 },
    { type: 'ema' as const, period: 50 },
    { type: 'rsi' as const, period: 14 },
    { type: 'macd' as const, fast: 12, slow: 26, signal: 9 },
  ];

  const point = {
    date: '2026-01-02',
    sma: 100,
    ema: null,
    rsi: 55.5,
    macd: 1.2,
    macdSignal: 1.0,
    macdHistogram: 0.2,
  };

  it('validates IndicatorType', () => {
    expect(isIndicatorType('sma')).toBe(true);
    expect(isIndicatorType('ema')).toBe(true);
    expect(isIndicatorType('rsi')).toBe(true);
    expect(isIndicatorType('macd')).toBe(true);
    expect(isIndicatorType('bb')).toBe(false);
  });

  it('validates IndicatorRequestSpec', () => {
    expect(isIndicatorRequestSpec({ type: 'sma', period: 20 })).toBe(true);
    expect(isIndicatorRequestSpec({ type: 'macd', fast: 12, slow: 26, signal: 9 })).toBe(true);
    expect(isIndicatorRequestSpec({ type: 'sma', period: 'x' })).toBe(false);
    expect(isIndicatorRequestSpec({ type: 'macd', fast: 12 })).toBe(false);
    expect(isIndicatorRequestSpec(null)).toBe(false);
    expect(isIndicatorRequestSpec({ type: 'bb' })).toBe(false);
  });

  it('validates IndicatorSeriesPoint', () => {
    expect(isIndicatorSeriesPoint(point)).toBe(true);
    expect(isIndicatorSeriesPoint({ date: '2026-01-02' })).toBe(true);
    expect(isIndicatorSeriesPoint(null)).toBe(false);
    expect(isIndicatorSeriesPoint({ date: 1 })).toBe(false);
    expect(isIndicatorSeriesPoint({ date: '2026-01-02', sma: 'x' })).toBe(false);
  });

  it('creates and validates IndicatorsResponseDto', () => {
    const withSymbol = createIndicatorsResponseDto({
      symbolId: 'sym_1',
      indicators: specs,
      points: [point],
    });
    expect(withSymbol.symbolId).toBe('sym_1');
    expect(isIndicatorsResponseDto(withSymbol)).toBe(true);

    const withoutSymbol = createIndicatorsResponseDto({
      indicators: specs,
      points: [],
    });
    expect(withoutSymbol.symbolId).toBeUndefined();
    expect(isIndicatorsResponseDto(withoutSymbol)).toBe(true);

    expect(isIndicatorsResponseDto(null)).toBe(false);
    expect(isIndicatorsResponseDto({ indicators: [], points: 'x' })).toBe(false);
    expect(isIndicatorsResponseDto({ symbolId: 1, indicators: [], points: [] })).toBe(false);
    expect(
      isIndicatorsResponseDto({
        indicators: [{ type: 'sma' }],
        points: [],
      }),
    ).toBe(false);
    expect(
      isIndicatorsResponseDto({
        indicators: [],
        points: [{ date: 1 }],
      }),
    ).toBe(false);
  });

  it('computes lookback from the longest indicator requirement', () => {
    expect(computeIndicatorLookback([{ type: 'sma', period: 20 }])).toBe(20);
    // EMA 50 が MACD(slow+signal=35) より長い
    expect(computeIndicatorLookback(specs)).toBe(50);
    expect(computeIndicatorLookback([{ type: 'macd', fast: 12, slow: 26, signal: 9 }])).toBe(
      35,
    );
    expect(computeIndicatorLookback([])).toBe(0);
  });
});

describe('shared-types chart', () => {
  it('accepts valid chart intervals', () => {
    expect(isChartInterval('1d')).toBe(true);
    expect(isChartInterval('1w')).toBe(true);
  });

  it('rejects invalid chart intervals', () => {
    expect(isChartInterval('1m')).toBe(false);
    expect(isChartInterval(1)).toBe(false);
    expect(isChartInterval(null)).toBe(false);
  });

  it('returns empty array for empty input', () => {
    expect(aggregateDailyBarsToWeekly([])).toEqual([]);
  });

  it('aggregates daily bars into UTC Monday-start weeks', () => {
    // 2026-01-05(月)〜01-09(金) と 01-12(月)〜01-13(火)
    const bars = [
      { date: '2026-01-07', open: 10, high: 12, low: 9, close: 11, volume: 100 },
      { date: '2026-01-05', open: 8, high: 9, low: 7, close: 8.5, volume: 50 },
      { date: '2026-01-09', open: 11, high: 15, low: 10, close: 14, volume: 200 },
      { date: '2026-01-12', open: 14, high: 16, low: 13, close: 15, volume: 80 },
      { date: '2026-01-13', open: 15, high: 17, low: 14.5, close: 16.5, volume: 90 },
    ];

    const weekly = aggregateDailyBarsToWeekly(bars);
    expect(weekly).toHaveLength(2);
    // 第1週: 5→9、日付キーは最終取引日 01-09
    expect(weekly[0]).toEqual({
      date: '2026-01-09',
      open: 8,
      high: 15,
      low: 7,
      close: 14,
      volume: 350,
    });
    // 第2週: 12→13
    expect(weekly[1]).toEqual({
      date: '2026-01-13',
      open: 14,
      high: 17,
      low: 13,
      close: 16.5,
      volume: 170,
    });
  });

  it('skips invalid dates and still aggregates valid bars', () => {
    const bars = [
      { date: 'not-a-date', open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { date: '2026-02-02', open: 2, high: 3, low: 1, close: 2.5, volume: 10 },
      { date: '2026-13-40', open: 9, high: 9, low: 9, close: 9, volume: 9 },
    ];
    const weekly = aggregateDailyBarsToWeekly(bars);
    expect(weekly).toEqual([
      { date: '2026-02-02', open: 2, high: 3, low: 1, close: 2.5, volume: 10 },
    ]);
  });

  it('preserves extra fields from the last bar of each week', () => {
    const bars = [
      {
        id: 'a',
        symbolId: 's1',
        date: '2026-03-02',
        open: 1,
        high: 2,
        low: 1,
        close: 1.5,
        volume: 5,
        createdAt: 'c1',
        updatedAt: 'u1',
      },
      {
        id: 'b',
        symbolId: 's1',
        date: '2026-03-03',
        open: 1.5,
        high: 3,
        low: 1.2,
        close: 2.8,
        volume: 7,
        createdAt: 'c2',
        updatedAt: 'u2',
      },
    ];
    const weekly = aggregateDailyBarsToWeekly(bars);
    expect(weekly).toEqual([
      {
        id: 'b',
        symbolId: 's1',
        date: '2026-03-03',
        open: 1,
        high: 3,
        low: 1,
        close: 2.8,
        volume: 12,
        createdAt: 'c2',
        updatedAt: 'u2',
      },
    ]);
  });

  it('groups Sunday into the previous Monday-start week', () => {
    // 2026-01-04 は日曜 → 2025-12-29(月) 始まりの週
    const bars = [
      { date: '2026-01-02', open: 1, high: 2, low: 1, close: 1.5, volume: 3 },
      { date: '2026-01-04', open: 1.5, high: 2.5, low: 1.4, close: 2, volume: 4 },
    ];
    const weekly = aggregateDailyBarsToWeekly(bars);
    expect(weekly).toHaveLength(1);
    expect(weekly[0]).toMatchObject({
      date: '2026-01-04',
      open: 1,
      close: 2,
      volume: 7,
    });
  });
});
