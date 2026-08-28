import {
  API_ERROR_CODES,
  computeIndicatorFutureBars,
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
  createIndicatorSetDto,
  defaultEnabledIndicatorIds,
  definitionsForCategory,
  definitionsForScoreGroup,
  isApiErrorBody,
  isAuthTokenResponse,
  isAuthUser,
  isDailyPriceDto,
  isHealthStatus,
  isIndicatorCatalogId,
  isIndicatorCategoryId,
  isIndicatorComputeType,
  isIndicatorDrawings,
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
  describeSignalRule,
  formatStrategyTypeShortLabel,
  formatStrategyLabel,
  backtestRunToListItem,
  formatTradeReason,
  formatDecisionScore,
  isBacktestRunDto,
  isBacktestRunListItemDto,
  isDeleteBacktestRunsResponse,
  isBacktestSummaryDto,
  isBacktestTradeReasonCode,
  isOptimizeBacktestResponse,
  isSignalCapableIndicatorIds,
  isSignalDefinitionDto,
  isSignalStrategyType,
  isBacktestSignalMode,
  listCatalogSmaPairs,
  resolveSignalRule,
  resolveTrendScoreSignalRule,
  DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS,
  isWatchlistDto,
  isWatchlistItemDto,
  isIndicatorSetDto,
  isChartInterval,
  aggregateDailyBarsToWeekly,
  parseIndicatorCatalogQuery,
  parseToggleableCatalogIds,
  recommendedIndicatorIds,
  scoringCatalogIds,
  specsFromCatalogIds,
  TREND_SCORE_GROUP_WEIGHTS,
  validateGroupWeights,
  validateSignalThresholds,
  resolveGroupWeights,
  resolveIndicatorParams,
  validateIndicatorParamOverrides,
  isIndicatorParamOverrides,
  serializeGroupWeights,
  parseGroupWeightsJson,
  serializeIndicatorParamOverrides,
  parseIndicatorParamOverridesJson,
  editableParamKeys,
  catalogIdsWithParams,
  effectiveLookbackBars,
  resolveSignalThresholds,
  scoreGroupCategoryIds,
  isGroupWeights,
  createTrendScoreResponseDto,
  isScoredIndicatorId,
  isTrendScoreGroupId,
  isTrendScorePoint,
  isTrendScoreResponseDto,
  scoreToGaugePercent,
  trendScoreGaugeExplanation,
  trendScoreGaugeSegments,
  trendScoreState,
  INDICATOR_CATALOG,
  sanitizePartialGroupWeights,
  INDICATOR_CATALOG_BY_ID,
} from '../src/index';

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
    expect(API_ERROR_CODES.SYMBOL_QUOTE_NOT_FOUND).toBe('SYMBOL_QUOTE_NOT_FOUND');
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
    expect(API_ERROR_CODES.INDICATOR_SET_NOT_FOUND).toBe('INDICATOR_SET_NOT_FOUND');
    expect(API_ERROR_CODES.INDICATOR_SET_ALREADY_EXISTS).toBe('INDICATOR_SET_ALREADY_EXISTS');
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
    indicatorSetId: 'iset_1',
    signalDefinitionId: null,
    strategyType: 'smaCross' as const,
    params: { shortPeriod: 25, longPeriod: 75 },
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
      sharpeRatio: 1.2,
      profitFactor: 1.5,
      buyHoldReturnRate: 0.08,
      buyHoldFinalEquity: 108000,
    },
    trades: [],
    equityPoints: [],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const runListItem = {
    id: 'run_1',
    symbolId: 'sym_1',
    indicatorSetId: 'iset_1',
    strategyType: 'smaCross' as const,
    fromDate: '2026-01-01',
    toDate: '2026-06-30',
    summary: run.summary,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('validates strategy types', () => {
    expect(isSignalStrategyType('smaCross')).toBe(true);
    expect(isSignalStrategyType('rsiThreshold')).toBe(true);
    expect(isSignalStrategyType('macdCross')).toBe(true);
    expect(isSignalStrategyType('trendScoreThreshold')).toBe(true);
    expect(isSignalStrategyType('other')).toBe(false);
    expect(isBacktestSignalMode('trendScore')).toBe(true);
    expect(isBacktestSignalMode('indicatorSet')).toBe(true);
    expect(isBacktestSignalMode('other')).toBe(false);
  });

  it('validates SignalDefinitionDto and BacktestRunDto', () => {
    expect(isSignalDefinitionDto(signal)).toBe(true);
    expect(isBacktestRunDto(run)).toBe(true);
    expect(isSignalDefinitionDto(null)).toBe(false);
    expect(isBacktestRunDto(null)).toBe(false);
    expect(isSignalDefinitionDto({ ...signal, strategyType: 'invalid' })).toBe(false);
    expect(isBacktestRunDto({ ...run, summary: null })).toBe(false);
    expect(isBacktestSummaryDto(run.summary)).toBe(true);
    expect(isBacktestSummaryDto(null)).toBe(false);
    expect(
      isOptimizeBacktestResponse({
        results: [{ shortPeriod: 5, longPeriod: 20, summary: run.summary }],
      }),
    ).toBe(true);
    expect(isOptimizeBacktestResponse({ results: [{ shortPeriod: 5 }] })).toBe(false);
    expect(isOptimizeBacktestResponse(null)).toBe(false);
    expect(isOptimizeBacktestResponse({ results: 'x' })).toBe(false);
    expect(isOptimizeBacktestResponse({ results: [null] })).toBe(false);
    expect(isBacktestRunDto({ ...run, indicatorSetId: 1 })).toBe(false);
    expect(isBacktestRunDto({ ...run, signalDefinitionId: 1 })).toBe(false);
    expect(isBacktestRunDto({ ...run, strategyType: 'invalid' })).toBe(false);
    expect(isBacktestRunDto({ ...run, isActive: 'x' })).toBe(false);
    expect(isBacktestRunListItemDto(runListItem)).toBe(true);
    expect(isBacktestRunListItemDto(null)).toBe(false);
    expect(isBacktestRunListItemDto({ ...runListItem, summary: null })).toBe(false);
    expect(isDeleteBacktestRunsResponse({ deletedCount: 2 })).toBe(true);
    expect(isDeleteBacktestRunsResponse({ deletedCount: '2' })).toBe(false);
    expect(isDeleteBacktestRunsResponse(null)).toBe(false);
  });
});

describe('shared-types signal-from-catalog', () => {
  it('resolves SMA cross when exactly two SMA ids are enabled', () => {
    const rule = resolveSignalRule(['sma25', 'sma200', 'bb']);
    expect(rule).toEqual({
      strategyType: 'smaCross',
      params: { shortPeriod: 25, longPeriod: 200 },
      label: 'SMAクロス 25/200',
    });
    expect(isSignalCapableIndicatorIds(new Set(['sma75', 'sma25']))).toBe(true);
  });

  it('prefers SMA over macd/rsi when two SMAs are present', () => {
    const rule = resolveSignalRule(['sma25', 'sma75', 'macd', 'rsi']);
    expect(rule?.strategyType).toBe('smaCross');
    expect(rule?.params).toEqual({ shortPeriod: 25, longPeriod: 75 });
  });

  it('resolves MACD then RSI when SMA count is not two', () => {
    expect(resolveSignalRule(['macd', 'rsi', 'sma25'])).toMatchObject({
      strategyType: 'macdCross',
      params: { fast: 12, slow: 26, signal: 9 },
    });
    expect(resolveSignalRule(['rsi', 'volume'])).toMatchObject({
      strategyType: 'rsiThreshold',
      params: { period: 14, lower: 30, upper: 70 },
    });
  });

  it('returns null and describes why when unresolved', () => {
    expect(resolveSignalRule(['bb', 'volume'])).toBeNull();
    expect(isSignalCapableIndicatorIds(['bb'])).toBe(false);
    expect(describeSignalRule(['sma25'])).toContain('ちょうど 2 本');
    expect(describeSignalRule(['sma25', 'sma75', 'sma200'])).toContain('ちょうど 2 本');
    expect(describeSignalRule(['bb'])).toContain('MACD / RSI');
    expect(describeSignalRule(['sma25', 'sma75'])).toContain('バックテスト用');
  });

  it('lists the three catalog SMA pairs', () => {
    expect(listCatalogSmaPairs()).toEqual([
      { shortId: 'sma25', longId: 'sma75', shortPeriod: 25, longPeriod: 75 },
      { shortId: 'sma25', longId: 'sma200', shortPeriod: 25, longPeriod: 200 },
      { shortId: 'sma75', longId: 'sma200', shortPeriod: 75, longPeriod: 200 },
    ]);
  });

  it('throws when a catalog numeric param is missing', () => {
    const originalFast = INDICATOR_CATALOG_BY_ID.macd.params.fast as number;
    INDICATOR_CATALOG_BY_ID.macd.params.fast = Number.NaN;
    expect(() => resolveSignalRule(['macd'])).toThrow(/missing numeric param/);
    INDICATOR_CATALOG_BY_ID.macd.params.fast = originalFast;
  });
});

describe('shared-types backtest-display', () => {
  it('formats strategy labels from snapshots', () => {
    expect(formatStrategyLabel('smaCross', { shortPeriod: 25, longPeriod: 75 })).toBe(
      'SMAクロス 25/75',
    );
    expect(formatStrategyLabel('macdCross', { fast: 12, slow: 26, signal: 9 })).toBe(
      'MACDクロス 12/26/9',
    );
    expect(formatStrategyLabel('rsiThreshold', { period: 14, lower: 30, upper: 70 })).toBe(
      'RSI閾値 14（≤30 / ≥70）',
    );
    expect(
      formatStrategyLabel('trendScoreThreshold', { buyThreshold: 37.5, sellThreshold: -42.5 }),
    ).toBe('トレンドスコア（≥37.5 / ≤-42.5）');
    expect(formatStrategyTypeShortLabel('smaCross')).toBe('SMAクロス');
    expect(formatStrategyTypeShortLabel('macdCross')).toBe('MACDクロス');
    expect(formatStrategyTypeShortLabel('rsiThreshold')).toBe('RSI閾値');
    expect(formatStrategyTypeShortLabel('trendScoreThreshold')).toBe('トレンドスコア');
    expect(
      backtestRunToListItem({
        id: 'run_1',
        userId: 'u_1',
        indicatorSetId: 'iset_1',
        signalDefinitionId: null,
        strategyType: 'smaCross',
        params: { shortPeriod: 25, longPeriod: 75 },
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
          sharpeRatio: 1.2,
          profitFactor: 1.5,
          buyHoldReturnRate: 0.08,
          buyHoldFinalEquity: 108000,
        },
        trades: [],
        equityPoints: [],
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      id: 'run_1',
      symbolId: 'sym_1',
      indicatorSetId: 'iset_1',
      strategyType: 'smaCross',
      fromDate: '2026-01-01',
      toDate: '2026-06-30',
      summary: {
        finalEquity: 110000,
        totalReturnRate: 0.1,
        maxDrawdownRate: 0.05,
        totalTrades: 5,
        winRate: 0.6,
        sharpeRatio: 1.2,
        profitFactor: 1.5,
        buyHoldReturnRate: 0.08,
        buyHoldFinalEquity: 108000,
      },
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('formats trade reason codes and rejects unknown', () => {
    expect(formatTradeReason('sma_golden_cross')).toBe('SMAゴールデンクロス');
    expect(formatTradeReason('force_close_end')).toBe('期間末強制決済');
    expect(formatTradeReason(null)).toBe('');
    expect(formatTradeReason(undefined)).toBe('');
    expect(formatTradeReason('')).toBe('');
    expect(formatTradeReason('unknown_code')).toBe('');
    expect(formatTradeReason('rsi_oversold', 28.45)).toBe('RSI売られすぎ（28.5）');
    expect(formatTradeReason('rsi_overbought', 70)).toBe('RSI買われすぎ（70）');
    expect(formatTradeReason('rsi_oversold', null)).toBe('RSI売られすぎ');
    expect(formatTradeReason('score_cross_up', 42.3)).toBe('スコア上昇クロス（42.3）');
    expect(formatTradeReason('score_cross_down', -50)).toBe('スコア下降クロス（-50）');
    expect(formatDecisionScore(28.45)).toBe('28.5');
    expect(formatDecisionScore(70)).toBe('70');
    expect(isBacktestTradeReasonCode('rsi_oversold')).toBe(true);
    expect(isBacktestTradeReasonCode('score_cross_up')).toBe(true);
    expect(isBacktestTradeReasonCode('nope')).toBe(false);
    expect(isBacktestTradeReasonCode(1)).toBe(false);
  });
});

describe('shared-types trend-score signal rule', () => {
  it('resolves defaults aligned to chart state boundaries', () => {
    expect(resolveTrendScoreSignalRule()).toEqual({
      strategyType: 'trendScoreThreshold',
      params: { ...DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS },
      label: 'トレンドスコア（≥37.5 / ≤-42.5）',
    });
    expect(resolveTrendScoreSignalRule({ buyThreshold: 50, sellThreshold: -50 }).params).toEqual({
      buyThreshold: 50,
      sellThreshold: -50,
    });
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

describe('shared-types indicator set', () => {
  const set = {
    id: 'set_1',
    userId: 'user_1',
    name: 'スイング',
    indicatorIds: ['sma25', 'rsi'] as const,
    indicatorParams: {},
    groupWeights: null,
    buyThreshold: null,
    sellThreshold: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('creates and validates IndicatorSetDto', () => {
    const dto = {
      ...set,
      indicatorIds: [...set.indicatorIds],
    };
    expect(createIndicatorSetDto(dto)).toEqual(dto);
    expect(isIndicatorSetDto(dto)).toBe(true);
    expect(isIndicatorSetDto({ ...dto, indicatorIds: [] })).toBe(true);
    expect(isIndicatorSetDto(null)).toBe(false);
    expect(isIndicatorSetDto({ ...dto, name: 1 })).toBe(false);
    expect(isIndicatorSetDto({ ...dto, indicatorIds: ['nope'] })).toBe(false);
    expect(isIndicatorSetDto({ ...dto, indicatorIds: 'sma25' })).toBe(false);
    expect(isIndicatorSetDto({ ...dto, indicatorParams: { bad: 'x' } })).toBe(false);
    expect(isIndicatorSetDto({ ...dto, indicatorParams: { sma25: null } })).toBe(false);
    expect(isIndicatorSetDto({ ...dto, indicatorParams: { sma25: { period: 'x' } } })).toBe(false);
    expect(isIndicatorSetDto({ ...dto, groupWeights: 'bad' })).toBe(false);
    expect(isIndicatorSetDto({ ...dto, indicatorParams: 1 })).toBe(false);
    expect(isIndicatorSetDto({ ...dto, buyThreshold: 'bad' })).toBe(false);
    expect(isIndicatorSetDto({ ...dto, sellThreshold: Number.POSITIVE_INFINITY })).toBe(false);
    expect(isIndicatorSetDto({ ...dto, indicatorParams: { sma25: { period: Number.NaN } } })).toBe(
      false,
    );
    expect(isIndicatorSetDto({ ...dto, groupWeights: [] })).toBe(false);
    const { indicatorParams: _p, groupWeights: _g, ...withoutOptional } = dto;
    expect(isIndicatorSetDto(withoutOptional)).toBe(true);
    expect(isGroupWeights(TREND_SCORE_GROUP_WEIGHTS)).toBe(true);
    expect(sanitizePartialGroupWeights({ trend: 40, bad: 1 })).toEqual({ trend: 40 });
  });
});

describe('shared-types indicator score config', () => {
  it('validates group weights sum to 100', () => {
    expect(validateGroupWeights(TREND_SCORE_GROUP_WEIGHTS).ok).toBe(true);
    expect(validateGroupWeights({ ...TREND_SCORE_GROUP_WEIGHTS, trend: 50 }).ok).toBe(false);
    expect(validateGroupWeights(null).ok).toBe(false);
    expect(validateGroupWeights({ trend: -1 }).ok).toBe(false);
    expect(resolveGroupWeights(null)).toEqual(TREND_SCORE_GROUP_WEIGHTS);
    expect(resolveGroupWeights({ trend: 50 })).toMatchObject({ trend: 50, momentum: 20 });
  });

  it('validates signal thresholds', () => {
    expect(validateSignalThresholds(37.5, -42.5).ok).toBe(true);
    expect(validateSignalThresholds(10, 20).ok).toBe(false);
    expect(validateSignalThresholds(200, 0).ok).toBe(false);
    expect(resolveSignalThresholds({ buyThreshold: 50 })).toEqual({
      buyThreshold: 50,
      sellThreshold: DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS.sellThreshold,
    });
    expect(resolveSignalThresholds({ sellThreshold: -50 })).toEqual({
      buyThreshold: DEFAULT_TREND_SCORE_SIGNAL_THRESHOLDS.buyThreshold,
      sellThreshold: -50,
    });
    expect(parseGroupWeightsJson(JSON.stringify(TREND_SCORE_GROUP_WEIGHTS))).toEqual(
      TREND_SCORE_GROUP_WEIGHTS,
    );
    expect(parseGroupWeightsJson('not-json')).toBeNull();
    expect(parseGroupWeightsJson('{"trend":50}')).toBeNull();
    expect(scoreGroupCategoryIds()).toHaveLength(6);
    expect(sanitizePartialGroupWeights(null)).toBeNull();
    expect(serializeGroupWeights(TREND_SCORE_GROUP_WEIGHTS)).toContain('trend');
  });
});

describe('shared-types indicator param rules', () => {
  it('merges and validates param overrides', () => {
    expect(resolveIndicatorParams('sma25', { sma25: { period: 30 } }).period).toBe(30);
    expect(validateIndicatorParamOverrides({ sma25: { period: 30 } }).ok).toBe(true);
    expect(validateIndicatorParamOverrides({ sma25: { nope: 1 } }).ok).toBe(false);
    expect(validateIndicatorParamOverrides({ nope: { period: 1 } }).ok).toBe(false);
    expect(validateIndicatorParamOverrides({ elliott: { period: 1 } }).ok).toBe(false);
    expect(validateIndicatorParamOverrides({ sma25: { period: 9999 } }).ok).toBe(false);
    expect(validateIndicatorParamOverrides(null).ok).toBe(true);
  });

  it('serializes and parses param overrides', () => {
    const overrides = { sma25: { period: 30 } };
    const json = serializeIndicatorParamOverrides(overrides);
    expect(parseIndicatorParamOverridesJson(json)).toEqual(overrides);
    expect(parseIndicatorParamOverridesJson('{')).toBeNull();
    expect(parseIndicatorParamOverridesJson('{"sma25":{"period":9999}}')).toBeNull();
    expect(isIndicatorParamOverrides(overrides)).toBe(true);
    expect(validateIndicatorParamOverrides({ sma25: null }).ok).toBe(false);
    expect(validateIndicatorParamOverrides({ sma25: { period: NaN } }).ok).toBe(false);
  });

  it('lists editable params and effective lookback', () => {
    expect(editableParamKeys('sma25')[0]?.key).toBe('period');
    expect(editableParamKeys('elliott')).toEqual([]);
    expect(catalogIdsWithParams()).toContain('sma25');
    expect(effectiveLookbackBars('sma25', { period: 100 })).toBeGreaterThanOrEqual(100);
    expect(effectiveLookbackBars('macd', {})).toBeGreaterThanOrEqual(35);
    expect(effectiveLookbackBars('ichimoku', {})).toBeGreaterThanOrEqual(78);
    expect(effectiveLookbackBars('stoch', {})).toBeGreaterThanOrEqual(20);
    expect(effectiveLookbackBars('keltner', {})).toBeGreaterThanOrEqual(20);
    expect(effectiveLookbackBars('ichimoku', { senkouB: 60, displacement: 26 })).toBeGreaterThanOrEqual(86);
    expect(
      effectiveLookbackBars('stoch', { kPeriod: 14, kSmoothing: 3, dPeriod: 3 }),
    ).toBeGreaterThanOrEqual(20);
    expect(effectiveLookbackBars('keltner', { emaPeriod: 30, atrPeriod: 12 })).toBeGreaterThanOrEqual(30);
    expect(effectiveLookbackBars('obv', {})).toBe(INDICATOR_CATALOG_BY_ID.obv.lookbackBars);
  });

  it('uses custom params in signal rule', () => {
    const rule = resolveSignalRule(new Set(['sma25', 'sma75']), {
      sma25: { period: 10 },
      sma75: { period: 30 },
    });
    expect(rule?.params).toEqual({ shortPeriod: 10, longPeriod: 30 });
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
  const specs = specsFromCatalogIds(['sma25', 'ema50', 'rsi', 'macd']);

  const point = {
    date: '2026-01-02',
    values: {
      sma25: 100,
      ema50: null,
      rsi: 55.5,
      macd: 1.2,
      macdSignal: 1.0,
      macdHistogram: 0.2,
    },
  };

  it('validates IndicatorType / compute type', () => {
    expect(isIndicatorType('sma')).toBe(true);
    expect(isIndicatorType('ema')).toBe(true);
    expect(isIndicatorType('rsi')).toBe(true);
    expect(isIndicatorType('macd')).toBe(true);
    expect(isIndicatorType('bb')).toBe(true);
    expect(isIndicatorType('elliott')).toBe(false);
    expect(isIndicatorComputeType('ichimoku')).toBe(true);
    expect(isIndicatorComputeType(1)).toBe(false);
  });

  it('validates IndicatorRequestSpec', () => {
    expect(isIndicatorRequestSpec({ id: 'sma25', type: 'sma', params: { period: 25 } })).toBe(
      true,
    );
    expect(
      isIndicatorRequestSpec({ id: 'macd', type: 'macd', params: { fast: 12, slow: 26, signal: 9 } }),
    ).toBe(true);
    expect(isIndicatorRequestSpec({ id: 'sma25', type: 'sma', params: { period: 'x' } })).toBe(
      false,
    );
    expect(isIndicatorRequestSpec({ id: 'macd', type: 'macd', params: null })).toBe(false);
    expect(isIndicatorRequestSpec(null)).toBe(false);
    expect(isIndicatorRequestSpec({ type: 'bb' })).toBe(false);
    expect(isIndicatorRequestSpec({ id: 'sma25', type: 'sma', params: [] })).toBe(false);
  });

  it('validates IndicatorSeriesPoint', () => {
    expect(isIndicatorSeriesPoint(point)).toBe(true);
    expect(isIndicatorSeriesPoint({ date: '2026-01-02', values: {} })).toBe(true);
    expect(isIndicatorSeriesPoint(null)).toBe(false);
    expect(isIndicatorSeriesPoint({ date: 1 })).toBe(false);
    expect(isIndicatorSeriesPoint({ date: '2026-01-02', values: { sma25: 'x' } })).toBe(false);
    expect(isIndicatorSeriesPoint({ date: '2026-01-02', values: [] })).toBe(false);
  });

  it('validates drawings', () => {
    expect(
      isIndicatorDrawings({
        fibonacci: {
          high: 10,
          low: 5,
          highDate: '2026-01-02',
          lowDate: '2026-01-01',
          levels: [{ ratio: 0.5, price: 7.5 }],
        },
        volumeProfile: { bins: [{ priceLow: 1, priceHigh: 2, volume: 3 }] },
      }),
    ).toBe(true);
    expect(isIndicatorDrawings({ fibonacci: null })).toBe(true);
    expect(isIndicatorDrawings({ fibonacci: 1 })).toBe(false);
    expect(isIndicatorDrawings({ volumeProfile: null })).toBe(true);
    expect(isIndicatorDrawings({ volumeProfile: { bins: [null] } })).toBe(false);
    expect(isIndicatorDrawings({ volumeProfile: { bins: 'x' } })).toBe(false);
    expect(isIndicatorDrawings({ volumeProfile: 1 })).toBe(false);
    expect(isIndicatorDrawings({ volumeProfile: [] })).toBe(false);
    expect(
      isIndicatorDrawings({
        fibonacci: {
          high: 10,
          low: 5,
          highDate: '2026-01-02',
          lowDate: '2026-01-01',
          levels: [{ ratio: 0.5 }],
        },
      }),
    ).toBe(false);
    expect(
      isIndicatorDrawings({
        fibonacci: {
          high: 10,
          low: 5,
          highDate: '2026-01-02',
          lowDate: '2026-01-01',
          levels: [{ ratio: 0.5, price: 7.5 }],
        },
        volumeProfile: null,
      }),
    ).toBe(true);
    expect(isIndicatorDrawings(null)).toBe(false);
    expect(isIndicatorDrawings([])).toBe(false);
    expect(
      isIndicatorDrawings({
        fibonacci: {
          high: 10,
          low: 5,
          highDate: '2026-01-02',
          lowDate: '2026-01-01',
          levels: [null],
        },
      }),
    ).toBe(false);
  });

  it('creates and validates IndicatorsResponseDto', () => {
    const withSymbol = createIndicatorsResponseDto({
      symbolId: 'sym_1',
      indicators: specs,
      points: [point],
      drawings: {
        fibonacci: {
          high: 2,
          low: 1,
          highDate: '2026-01-02',
          lowDate: '2026-01-01',
          levels: [{ ratio: 0, price: 2 }],
        },
      },
    });
    expect(withSymbol.symbolId).toBe('sym_1');
    expect(withSymbol.drawings?.fibonacci?.high).toBe(2);
    expect(isIndicatorsResponseDto(withSymbol)).toBe(true);

    const withoutSymbol = createIndicatorsResponseDto({
      indicators: specs,
      points: [],
    });
    expect(withoutSymbol.symbolId).toBeUndefined();
    expect(isIndicatorsResponseDto(withoutSymbol)).toBe(true);
    expect(
      isIndicatorsResponseDto({
        indicators: [],
        points: [],
        drawings: null,
      }),
    ).toBe(true);

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
    expect(
      isIndicatorsResponseDto({
        indicators: [],
        points: [],
        drawings: { fibonacci: { high: 1 } },
      }),
    ).toBe(false);
  });

  it('computes lookback and future bars from the catalog', () => {
    expect(computeIndicatorLookback(specsFromCatalogIds(['sma25']))).toBe(25);
    expect(computeIndicatorLookback(specs)).toBe(50);
    expect(computeIndicatorLookback(specsFromCatalogIds(['macd']))).toBe(35);
    expect(computeIndicatorLookback(specsFromCatalogIds(['ichimoku']))).toBe(78);
    expect(computeIndicatorLookback([])).toBe(0);
    expect(computeIndicatorFutureBars(specsFromCatalogIds(['ichimoku']))).toBe(26);
    expect(computeIndicatorFutureBars(specsFromCatalogIds(['sma25']))).toBe(0);
  });
});

describe('shared-types indicator catalog', () => {
  it('validates catalog and category IDs', () => {
    expect(isIndicatorCatalogId('sma25')).toBe(true);
    expect(isIndicatorCatalogId('elliott')).toBe(true);
    expect(isIndicatorCatalogId('sma')).toBe(false);
    expect(isIndicatorCategoryId('trend')).toBe(true);
    expect(isIndicatorCategoryId('unknown')).toBe(false);
  });

  it('parses indicator query strings', () => {
    const parsedDefault = parseIndicatorCatalogQuery();
    expect(parsedDefault).toEqual({ ok: true, ids: recommendedIndicatorIds() });
    expect(parseIndicatorCatalogQuery(' sma25 , macd ').ok).toBe(true);
    expect(parseIndicatorCatalogQuery('sma25,sma25')).toEqual({ ok: true, ids: ['sma25'] });
    expect(parseIndicatorCatalogQuery('nope')).toEqual({
      ok: false,
      reason: 'unknown',
      token: 'nope',
    });
    expect(parseIndicatorCatalogQuery(' , ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseIndicatorCatalogQuery('elliott')).toEqual({
      ok: false,
      reason: 'disabled',
      token: 'elliott',
    });
  });

  it('parses toggleable catalog ids for saved sets', () => {
    expect(parseToggleableCatalogIds([])).toEqual({ ok: true, ids: [] });
    expect(parseToggleableCatalogIds(['sma25', 'sma25', 'volume'])).toEqual({
      ok: true,
      ids: ['sma25', 'volume'],
    });
    expect(parseToggleableCatalogIds(['nope'])).toEqual({
      ok: false,
      reason: 'unknown',
      token: 'nope',
    });
    expect(parseToggleableCatalogIds(['elliott'])).toEqual({
      ok: false,
      reason: 'disabled',
      token: 'elliott',
    });
  });

  it('builds specs and category lists', () => {
    expect(specsFromCatalogIds(['volume', 'sma25', 'elliott'])).toEqual([
      { id: 'sma25', type: 'sma', params: { period: 25 } },
    ]);
    expect(defaultEnabledIndicatorIds()).toContain('volume');
    expect(recommendedIndicatorIds()).not.toContain('volume');
    expect(definitionsForCategory('oscillator').some((d) => d.id === 'rsi')).toBe(true);
    expect(definitionsForCategory('trend').some((d) => d.id === 'macd')).toBe(true);
    // Ph6: MACD / RSI は scoreGroup 代表分類のみ（モメンタムへの重複なし）
    expect(definitionsForCategory('momentum').some((d) => d.id === 'macd')).toBe(false);
    expect(definitionsForCategory('momentum').some((d) => d.id === 'rsi')).toBe(false);
    expect(definitionsForScoreGroup('trend').some((d) => d.id === 'macd')).toBe(true);
    expect(definitionsForScoreGroup('oscillator').some((d) => d.id === 'rsi')).toBe(true);
    expect(definitionsForScoreGroup('momentum').some((d) => d.id === 'macd')).toBe(false);
  });

  it('assigns a single scoreGroup per indicator without double counting', () => {
    expect(INDICATOR_CATALOG_BY_ID.macd.scoreGroup).toBe('trend');
    expect(INDICATOR_CATALOG_BY_ID.macd.categories).toEqual(['trend']);
    expect(INDICATOR_CATALOG_BY_ID.ichimoku.scoreGroup).toBe('trend');
    expect(INDICATOR_CATALOG_BY_ID.rsi.scoreGroup).toBe('oscillator');
    expect(INDICATOR_CATALOG_BY_ID.rsi.categories).toEqual(['oscillator']);
    expect(INDICATOR_CATALOG_BY_ID.cci.scoreGroup).toBe('oscillator');
    expect(INDICATOR_CATALOG_BY_ID.elliott.scoreGroup).toBeNull();
    expect(scoringCatalogIds()).not.toContain('elliott');
    expect(scoringCatalogIds()).toContain('volume');
    expect(INDICATOR_CATALOG.filter((item) => item.scoreGroup === null).map((item) => item.id)).toEqual([
      'elliott',
    ]);
    const weightSum = Object.values(TREND_SCORE_GROUP_WEIGHTS).reduce((sum, value) => sum + value, 0);
    expect(weightSum).toBe(100);
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

describe('shared-types trend score', () => {
  const groups = {
    trend: 10,
    momentum: 5,
    oscillator: 0,
    volatility: -1,
    volume: 2,
    cycle: null,
  };
  const point = {
    date: '2026-01-02',
    score: 16,
    groups,
    indicators: { sma25: 80, rsi: null },
  };

  it('maps scores to state labels including null and lower bound', () => {
    expect(trendScoreState(95).id).toBe('strongUp');
    expect(trendScoreState(77.5).id).toBe('strongUp');
    expect(trendScoreState(60).id).toBe('upTrend');
    expect(trendScoreState(15).id).toBe('rangeUp');
    expect(trendScoreState(0).id).toBe('range');
    expect(trendScoreState(null).id).toBe('range');
    expect(trendScoreState(-20).id).toBe('rangeDown');
    expect(trendScoreState(-65).id).toBe('downTrend');
    expect(trendScoreState(-95).labelJa).toBe('暴落に近い強い下降');
    expect(trendScoreState(-80).id).toBe('downTrend');
    expect(trendScoreState(-80.1).id).toBe('strongDown');
  });

  it('builds gauge segments and maps score position / explanation', () => {
    const segments = trendScoreGaugeSegments();
    expect(segments[0]?.id).toBe('strongDown');
    expect(segments[0]?.from).toBe(-100);
    expect(segments[segments.length - 1]?.id).toBe('strongUp');
    expect(segments[segments.length - 1]?.to).toBe(100);
    expect(scoreToGaugePercent(-100)).toBe(0);
    expect(scoreToGaugePercent(0)).toBe(50);
    expect(scoreToGaugePercent(100)).toBe(100);
    expect(scoreToGaugePercent(200)).toBe(100);
    expect(scoreToGaugePercent(-200)).toBe(0);
    expect(trendScoreGaugeExplanation(null)).toContain('算出できない');
    expect(trendScoreGaugeExplanation(42)).toContain('上昇トレンド');
    expect(trendScoreGaugeExplanation(42)).toContain('37.5〜77.5');
    expect(trendScoreGaugeExplanation(-95)).toContain('暴落に近い強い下降');
  });

  it('creates and validates TrendScoreResponseDto', () => {
    const withSymbol = createTrendScoreResponseDto({ symbolId: 'sym_1', points: [point] });
    expect(withSymbol.symbolId).toBe('sym_1');
    expect(isTrendScoreResponseDto(withSymbol)).toBe(true);
    const withoutSymbol = createTrendScoreResponseDto({ points: [] });
    expect(withoutSymbol.symbolId).toBeUndefined();
    expect(isTrendScoreResponseDto(withoutSymbol)).toBe(true);
  });

  it('rejects invalid trend score payloads', () => {
    expect(isTrendScoreResponseDto(null)).toBe(false);
    expect(isTrendScoreResponseDto({ points: 'x' })).toBe(false);
    expect(isTrendScoreResponseDto({ symbolId: 1, points: [] })).toBe(false);
    expect(isTrendScorePoint(null)).toBe(false);
    expect(isTrendScorePoint({ date: 1, score: 0, groups, indicators: {} })).toBe(false);
    expect(isTrendScorePoint({ date: '2026-01-02', score: 'x', groups, indicators: {} })).toBe(false);
    expect(
      isTrendScorePoint({ date: '2026-01-02', score: 0, groups: [], indicators: {} }),
    ).toBe(false);
    expect(
      isTrendScorePoint({ date: '2026-01-02', score: 0, groups: null, indicators: {} }),
    ).toBe(false);
    expect(
      isTrendScorePoint({
        date: '2026-01-02',
        score: 0,
        groups: { trend: 1, momentum: 1, oscillator: 1, volatility: 1, volume: 1 },
        indicators: {},
      }),
    ).toBe(false);
    expect(
      isTrendScorePoint({
        date: '2026-01-02',
        score: 0,
        groups: { ...groups, trend: 'x' },
        indicators: {},
      }),
    ).toBe(false);
    expect(
      isTrendScorePoint({ date: '2026-01-02', score: 0, groups, indicators: [] }),
    ).toBe(false);
    expect(
      isTrendScorePoint({ date: '2026-01-02', score: 0, groups, indicators: { sma25: 'x' } }),
    ).toBe(false);
    expect(isTrendScorePoint({ date: '2026-01-02', score: 0, groups, indicators: {} })).toBe(true);
    expect(isScoredIndicatorId('sma25')).toBe(true);
    expect(isScoredIndicatorId('nope')).toBe(false);
    expect(isTrendScoreGroupId('trend')).toBe(true);
    expect(isTrendScoreGroupId('nope')).toBe(false);
  });
});
