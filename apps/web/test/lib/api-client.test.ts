import {
  ApiClientError,
  addPortfolioHolding,
  addWatchlistItem,
  apiFetch,
  createPortfolio,
  createSignalDefinition,
  createIndicatorSet,
  createWatchlist,
  deleteSignalDefinition,
  deleteIndicatorSet,
  deletePortfolio,
  deleteWatchlist,
  fetchBacktestRuns,
  fetchCurrentUser,
  fetchIndicatorSets,
  fetchSignalDefinitions,
  fetchPortfolios,
  fetchSymbolPrices,
  fetchSymbolIndicators,
  fetchSymbolTrendScore,
  fetchSymbols,
  createSymbol,
  fetchWatchlists,
  loginUser,
  registerUser,
  removePortfolioHolding,
  removeWatchlistItem,
  runBacktest,
  optimizeBacktest,
  updatePortfolioHolding,
  updateSignalDefinition,
} from '../../lib/api-client';
import * as authToken from '../../lib/auth-token';

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

const watchlist = {
  id: 'wl_1',
  userId: 'user_1',
  name: 'Tech',
  items: [
    {
      id: 'item_1',
      watchlistId: 'wl_1',
      symbolId: 'sym_1',
      symbol,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const portfolio = {
  id: 'pf_1',
  userId: 'user_1',
  name: 'Core',
  holdings: [
    {
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
    },
  ],
  totalsByCurrency: [
    {
      currency: 'USD',
      totalCost: 1000,
      totalMarketValue: 1100,
      unrealizedPnl: 100,
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const signal = {
  id: 'sig_1',
  userId: 'user_1',
  name: 'SMA 5/20',
  strategyType: 'smaCross' as const,
  params: { shortPeriod: 5, longPeriod: 20 },
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const indicatorSet = {
  id: 'set_1',
  userId: 'user_1',
  name: 'スイング',
  indicatorIds: ['sma25', 'rsi'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const dailyPrice = {
  id: 'price_1',
  symbolId: 'sym_1',
  date: '2026-01-02',
  open: 100,
  high: 105,
  low: 99,
  close: 103,
  volume: 1000,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const run = {
  id: 'run_1',
  userId: 'user_1',
  indicatorSetId: 'set_1',
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
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function okJson(body: unknown) {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  });
}

describe('api-client', () => {
  beforeEach(() => {
    jest.spyOn(authToken, 'getAccessToken').mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts register and validates response', async () => {
    const fetchImpl = okJson({
      accessToken: 't',
      tokenType: 'Bearer',
      user: { id: '1', email: 'a@b.c' },
    });

    await expect(
      registerUser({ email: 'a@b.c', password: 'password123' }, fetchImpl as unknown as typeof fetch),
    ).resolves.toEqual({
      accessToken: 't',
      tokenType: 'Bearer',
      user: { id: '1', email: 'a@b.c' },
    });
  });

  it('posts login and validates response', async () => {
    const fetchImpl = okJson({
      accessToken: 't',
      tokenType: 'Bearer',
      user: { id: '1', email: 'a@b.c' },
    });

    await expect(
      loginUser({ email: 'a@b.c', password: 'password123' }, fetchImpl as unknown as typeof fetch),
    ).resolves.toMatchObject({ accessToken: 't' });
  });

  it('fetches current user with bearer token', async () => {
    jest.spyOn(authToken, 'getAccessToken').mockReturnValue('tok');
    const fetchImpl = okJson({ id: '1', email: 'a@b.c' });

    await expect(fetchCurrentUser(fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      id: '1',
      email: 'a@b.c',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it('fetches symbols / watchlists / portfolios', async () => {
    await expect(
      fetchSymbols(okJson([symbol]) as unknown as typeof fetch),
    ).resolves.toEqual([symbol]);
    await expect(
      createSymbol({ ticker: 'AAPL', market: 'US' }, okJson(symbol) as unknown as typeof fetch),
    ).resolves.toEqual(symbol);
    await expect(
      fetchWatchlists(okJson([watchlist]) as unknown as typeof fetch),
    ).resolves.toEqual([watchlist]);
    await expect(
      fetchPortfolios(okJson([portfolio]) as unknown as typeof fetch),
    ).resolves.toEqual([portfolio]);
  });

  it('fetches symbol prices with optional date range', async () => {
    const withRange = okJson([dailyPrice]);
    await expect(
      fetchSymbolPrices(
        'sym_1',
        { from: '2026-01-01', to: '2026-06-30' },
        withRange as unknown as typeof fetch,
      ),
    ).resolves.toEqual([dailyPrice]);
    expect(withRange).toHaveBeenCalledWith(
      expect.stringContaining('/symbols/sym_1/prices?from=2026-01-01&to=2026-06-30'),
      expect.any(Object),
    );

    const fromOnly = okJson([dailyPrice]);
    await expect(
      fetchSymbolPrices('sym_1', { from: '2026-01-01' }, fromOnly as unknown as typeof fetch),
    ).resolves.toEqual([dailyPrice]);
    expect(fromOnly).toHaveBeenCalledWith(
      expect.stringContaining('/symbols/sym_1/prices?from=2026-01-01'),
      expect.any(Object),
    );

    const toOnly = okJson([dailyPrice]);
    await expect(
      fetchSymbolPrices('sym_1', { to: '2026-06-30' }, toOnly as unknown as typeof fetch),
    ).resolves.toEqual([dailyPrice]);
    expect(toOnly).toHaveBeenCalledWith(
      expect.stringContaining('/symbols/sym_1/prices?to=2026-06-30'),
      expect.any(Object),
    );

    const withDefaultRange = okJson([dailyPrice]);
    await expect(
      fetchSymbolPrices('sym_1', undefined, withDefaultRange as unknown as typeof fetch),
    ).resolves.toEqual([dailyPrice]);
    expect(withDefaultRange).toHaveBeenCalledWith(
      expect.stringMatching(/\/symbols\/sym_1\/prices$/),
      expect.any(Object),
    );

    const withInterval = okJson([dailyPrice]);
    await expect(
      fetchSymbolPrices(
        'sym_1',
        { interval: '1w' },
        withInterval as unknown as typeof fetch,
      ),
    ).resolves.toEqual([dailyPrice]);
    expect(withInterval).toHaveBeenCalledWith(
      expect.stringContaining('/symbols/sym_1/prices?interval=1w'),
      expect.any(Object),
    );
  });

  it('fetches symbol indicators with query options', async () => {
    const indicatorsResponse = {
      symbolId: 'sym_1',
      indicators: [{ id: 'sma25' as const, type: 'sma' as const, params: { period: 25 } }],
      points: [{ date: '2026-01-02', values: { sma25: 10 } }],
    };
    const full = okJson(indicatorsResponse);
    await expect(
      fetchSymbolIndicators(
        'sym_1',
        {
          from: '2026-01-01',
          to: '2026-06-30',
          interval: '1d',
          indicators: 'sma25,ema50',
        },
        full as unknown as typeof fetch,
      ),
    ).resolves.toEqual(indicatorsResponse);
    expect(full).toHaveBeenCalledWith(
      expect.stringContaining('/symbols/sym_1/indicators?'),
      expect.any(Object),
    );
    const calledUrl = String(full.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('from=2026-01-01');
    expect(calledUrl).toContain('to=2026-06-30');
    expect(calledUrl).toContain('interval=1d');
    expect(calledUrl).toContain('indicators=sma25%2Cema50');

    const bare = okJson(indicatorsResponse);
    await expect(
      fetchSymbolIndicators('sym_1', undefined, bare as unknown as typeof fetch),
    ).resolves.toEqual(indicatorsResponse);
    expect(bare).toHaveBeenCalledWith(
      expect.stringMatching(/\/symbols\/sym_1\/indicators$/),
      expect.any(Object),
    );

    const invalid = okJson({ bad: true });
    await expect(
      fetchSymbolIndicators('sym_1', {}, invalid as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(ApiClientError);

    const withNullDrawings = {
      symbolId: 'sym_1',
      indicators: [{ id: 'sma25' as const, type: 'sma' as const, params: { period: 25 } }],
      points: [{ date: '2026-01-02', values: { sma25: 10 } }],
      drawings: null,
    };
    const nullDrawings = okJson(withNullDrawings);
    await expect(
      fetchSymbolIndicators('sym_1', {}, nullDrawings as unknown as typeof fetch),
    ).resolves.toEqual(withNullDrawings);
  });

  it('fetches symbol trend score with query options', async () => {
    const trendResponse = {
      symbolId: 'sym_1',
      points: [
        {
          date: '2026-01-02',
          score: 12,
          groups: {
            trend: 8,
            momentum: 2,
            oscillator: 0,
            volatility: 1,
            volume: 1,
            cycle: 0,
          },
          indicators: { sma25: 20 },
        },
      ],
    };
    const full = okJson(trendResponse);
    await expect(
      fetchSymbolTrendScore(
        'sym_1',
        { from: '2026-01-01', to: '2026-06-30', interval: '1d' },
        full as unknown as typeof fetch,
      ),
    ).resolves.toEqual(trendResponse);
    expect(full).toHaveBeenCalledWith(
      expect.stringContaining('/symbols/sym_1/trend-score?'),
      expect.any(Object),
    );
    const calledUrl = String(full.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('from=2026-01-01');
    expect(calledUrl).toContain('to=2026-06-30');
    expect(calledUrl).toContain('interval=1d');

    const bare = okJson(trendResponse);
    await expect(
      fetchSymbolTrendScore('sym_1', undefined, bare as unknown as typeof fetch),
    ).resolves.toEqual(trendResponse);
    expect(bare).toHaveBeenCalledWith(
      expect.stringMatching(/\/symbols\/sym_1\/trend-score$/),
      expect.any(Object),
    );

    const invalid = okJson({ bad: true });
    await expect(
      fetchSymbolTrendScore('sym_1', {}, invalid as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(ApiClientError);
  });

  it('creates and mutates watchlists', async () => {
    await expect(
      createWatchlist('Tech', okJson(watchlist) as unknown as typeof fetch),
    ).resolves.toEqual(watchlist);
    await expect(
      addWatchlistItem('wl_1', 'sym_1', okJson(watchlist) as unknown as typeof fetch),
    ).resolves.toEqual(watchlist);
    await expect(
      removeWatchlistItem('wl_1', 'item_1', okJson(watchlist) as unknown as typeof fetch),
    ).resolves.toEqual(watchlist);

    const del = jest.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null });
    await expect(deleteWatchlist('wl_1', del as unknown as typeof fetch)).resolves.toBeUndefined();
  });

  it('creates and mutates portfolios', async () => {
    await expect(
      createPortfolio('Core', okJson(portfolio) as unknown as typeof fetch),
    ).resolves.toEqual(portfolio);
    await expect(
      addPortfolioHolding(
        'pf_1',
        { symbolId: 'sym_1', quantity: 10, averageCost: 100 },
        okJson(portfolio) as unknown as typeof fetch,
      ),
    ).resolves.toEqual(portfolio);
    await expect(
      updatePortfolioHolding(
        'pf_1',
        'h_1',
        { quantity: 12 },
        okJson(portfolio) as unknown as typeof fetch,
      ),
    ).resolves.toEqual(portfolio);
    await expect(
      removePortfolioHolding('pf_1', 'h_1', okJson(portfolio) as unknown as typeof fetch),
    ).resolves.toEqual(portfolio);

    const del = jest.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null });
    await expect(deletePortfolio('pf_1', del as unknown as typeof fetch)).resolves.toBeUndefined();
  });

  it('handles signal definition and backtest APIs', async () => {
    await expect(
      fetchSignalDefinitions(okJson([signal]) as unknown as typeof fetch),
    ).resolves.toEqual([signal]);
    await expect(
      createSignalDefinition(
        { name: 'SMA', strategyType: 'smaCross', params: { shortPeriod: 5, longPeriod: 20 } },
        okJson(signal) as unknown as typeof fetch,
      ),
    ).resolves.toEqual(signal);
    await expect(
      updateSignalDefinition('sig_1', { name: 'SMA2' }, okJson(signal) as unknown as typeof fetch),
    ).resolves.toEqual(signal);

    const del = jest.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null });
    await expect(
      deleteSignalDefinition('sig_1', del as unknown as typeof fetch),
    ).resolves.toBeUndefined();

    await expect(fetchBacktestRuns(okJson([run]) as unknown as typeof fetch)).resolves.toEqual([run]);
    await expect(
      runBacktest(
        {
          indicatorSetId: 'set_1',
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 100000,
          feeRate: 0.001,
          slippageRate: 0.001,
        },
        okJson(run) as unknown as typeof fetch,
      ),
    ).resolves.toEqual(run);

    const optimizeBody = {
      results: [{ shortPeriod: 5, longPeriod: 20, summary: run.summary }],
    };
    await expect(
      optimizeBacktest(
        {
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 100000,
          feeRate: 0.001,
          slippageRate: 0.001,
        },
        okJson(optimizeBody) as unknown as typeof fetch,
      ),
    ).resolves.toEqual(optimizeBody);
  });

  it('handles indicator set APIs', async () => {
    await expect(
      fetchIndicatorSets(okJson([indicatorSet]) as unknown as typeof fetch),
    ).resolves.toEqual([indicatorSet]);
    await expect(
      createIndicatorSet('スイング', ['sma25', 'rsi'], okJson(indicatorSet) as unknown as typeof fetch),
    ).resolves.toEqual(indicatorSet);
    const del = jest.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null });
    await expect(deleteIndicatorSet('set_1', del as unknown as typeof fetch)).resolves.toBeUndefined();
  });

  it('rejects invalid list and entity responses', async () => {
    await expect(
      fetchSymbols(okJson([{ id: 1 }]) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      createSymbol(
        { ticker: 'AAPL', market: 'US' },
        okJson({ id: 1 }) as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      createWatchlist('x', okJson({ id: 1 }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      addWatchlistItem('wl_1', 'sym_1', okJson({ id: 1 }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      removeWatchlistItem('wl_1', 'item_1', okJson({ id: 1 }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      createPortfolio('x', okJson({ id: 1 }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      addPortfolioHolding(
        'pf_1',
        { symbolId: 's', quantity: 1, averageCost: 1 },
        okJson({ id: 1 }) as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      updatePortfolioHolding('pf_1', 'h_1', {}, okJson({ id: 1 }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      removePortfolioHolding('pf_1', 'h_1', okJson({ id: 1 }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      createSignalDefinition(
        { name: 'SMA', strategyType: 'smaCross', params: { shortPeriod: 5, longPeriod: 20 } },
        okJson({ id: 1 }) as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      updateSignalDefinition('s', {}, okJson({ id: 1 }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      runBacktest(
        {
          indicatorSetId: 'set_1',
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 100000,
          feeRate: 0.001,
          slippageRate: 0.001,
        },
        okJson({ id: 1 }) as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      optimizeBacktest(
        {
          symbolId: 'sym_1',
          from: '2026-01-01',
          to: '2026-06-30',
          initialCash: 100000,
          feeRate: 0.001,
          slippageRate: 0.001,
        },
        okJson({ results: [{ shortPeriod: 5 }] }) as unknown as typeof fetch,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      fetchSignalDefinitions(okJson([{ id: 1 }]) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      fetchBacktestRuns(okJson([{ id: 1 }]) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      fetchIndicatorSets(okJson([{ id: 1 }]) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      createIndicatorSet('x', ['sma25'], okJson({ id: 1 }) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(
      fetchSymbolPrices('sym_1', {}, okJson([{ id: 1 }]) as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('throws ApiClientError for ApiErrorBody responses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        statusCode: 401,
        code: 'AUTH_UNAUTHORIZED',
        message: 'nope',
        timestamp: '2026-01-01T00:00:00.000Z',
      }),
    });

    await expect(apiFetch('/x', {}, fetchImpl as unknown as typeof fetch)).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });

  it('throws generic ApiClientError when body is not ApiErrorBody', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ weird: true }),
    });

    await expect(apiFetch('/x', {}, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
      code: 'HTTP_ERROR',
    });
  });

  it('throws when register response shape is invalid', async () => {
    const fetchImpl = okJson({ accessToken: 't' });

    await expect(
      registerUser({ email: 'a@b.c', password: 'password123' }, fetchImpl as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('throws when login response shape is invalid', async () => {
    const fetchImpl = okJson({ nope: true });

    await expect(
      loginUser({ email: 'a@b.c', password: 'x' }, fetchImpl as unknown as typeof fetch),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('throws when me response shape is invalid', async () => {
    const fetchImpl = okJson({ id: 1 });

    await expect(fetchCurrentUser(fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('handles non-json error bodies', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(apiFetch('/x', {}, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
      code: 'HTTP_ERROR',
    });
  });

  it('sets content-type when body is present and header missing', async () => {
    const fetchImpl = okJson({ id: '1', email: 'a@b.c' });

    await apiFetch('/auth/me', { method: 'POST', body: '{}' }, fetchImpl as unknown as typeof fetch);
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('keeps existing content-type header', async () => {
    const fetchImpl = okJson({ id: '1', email: 'a@b.c' });

    await apiFetch(
      '/auth/me',
      { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } },
      fetchImpl as unknown as typeof fetch,
    );
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('Content-Type')).toBe('text/plain');
  });

  it('uses global fetch and default options when omitted', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = okJson({ id: '1', email: 'a@b.c' });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      await expect(apiFetch('/auth/me')).resolves.toEqual({ id: '1', email: 'a@b.c' });
      expect(mockFetch).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
