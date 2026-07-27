import {
  ApiClientError,
  addPortfolioHolding,
  addWatchlistItem,
  apiFetch,
  createPortfolio,
  createWatchlist,
  deletePortfolio,
  deleteWatchlist,
  fetchCurrentUser,
  fetchPortfolios,
  fetchSymbols,
  fetchWatchlists,
  loginUser,
  registerUser,
  removePortfolioHolding,
  removeWatchlistItem,
  updatePortfolioHolding,
} from './api-client';
import * as authToken from './auth-token';

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
      fetchWatchlists(okJson([watchlist]) as unknown as typeof fetch),
    ).resolves.toEqual([watchlist]);
    await expect(
      fetchPortfolios(okJson([portfolio]) as unknown as typeof fetch),
    ).resolves.toEqual([portfolio]);
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

  it('rejects invalid list and entity responses', async () => {
    await expect(
      fetchSymbols(okJson([{ id: 1 }]) as unknown as typeof fetch),
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
