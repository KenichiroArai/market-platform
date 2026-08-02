/**
 * NestJS API 向けの薄い HTTP クライアント。
 *
 * 成功時は JSON、失敗時は ApiErrorBody を投げ、UI が code で分岐できるようにする。
 */
import {
  isApiErrorBody,
  isAuthTokenResponse,
  isAuthUser,
  isBacktestRunDto,
  isDailyPriceDto,
  isIndicatorsResponseDto,
  isPortfolioDto,
  isSignalDefinitionDto,
  isSymbolDto,
  isWatchlistDto,
  type AuthTokenResponse,
  type AuthUser,
  type ChartInterval,
  type DailyPriceDto,
  type IndicatorsResponseDto,
  type LoginRequest,
  type PortfolioDto,
  type BacktestRunDto,
  type RegisterRequest,
  type SignalDefinitionDto,
  type SignalStrategyParams,
  type SignalStrategyType,
  type SymbolDto,
  type WatchlistDto,
} from '@market/shared-types';
import { getApiBaseUrl } from './api-base-url';
import { getAccessToken } from './auth-token';

/** API 呼び出し失敗時に投げる。body が共通形式なら保持する。 */
export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly body: unknown;

  constructor(statusCode: number, code: string, message: string, body: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.body = body;
  }
}

/**
 * JSON API を呼び出す共通処理。
 * Bearer トークンがある場合は Authorization を付与する。
 * 204 No Content などボディ無し成功は null を返す。
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetchImpl(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null as T;
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiClientError(payload.statusCode, payload.code, payload.message, payload);
    }
    throw new ApiClientError(response.status, 'HTTP_ERROR', 'Request failed', payload);
  }

  return payload as T;
}

/** 配列レスポンスの各要素を type guard で検証する。 */
function assertArray<T>(
  value: unknown,
  guard: (item: unknown) => item is T,
  label: string,
): T[] {
  if (!Array.isArray(value) || !value.every(guard)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', `Unexpected ${label} response`, value);
  }
  return value;
}

/** POST /auth/register */
export async function registerUser(
  body: RegisterRequest,
  fetchImpl?: typeof fetch,
): Promise<AuthTokenResponse> {
  const result = await apiFetch<AuthTokenResponse>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify(body) },
    fetchImpl,
  );
  if (!isAuthTokenResponse(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected register response', result);
  }
  return result;
}

/** POST /auth/login */
export async function loginUser(
  body: LoginRequest,
  fetchImpl?: typeof fetch,
): Promise<AuthTokenResponse> {
  const result = await apiFetch<AuthTokenResponse>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(body) },
    fetchImpl,
  );
  if (!isAuthTokenResponse(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected login response', result);
  }
  return result;
}

/** GET /auth/me（Bearer 必須） */
export async function fetchCurrentUser(fetchImpl?: typeof fetch): Promise<AuthUser> {
  const result = await apiFetch<AuthUser>('/auth/me', { method: 'GET' }, fetchImpl);
  if (!isAuthUser(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected me response', result);
  }
  return result;
}

/** GET /symbols */
export async function fetchSymbols(fetchImpl?: typeof fetch): Promise<SymbolDto[]> {
  const result = await apiFetch<unknown>('/symbols', { method: 'GET' }, fetchImpl);
  return assertArray(result, isSymbolDto, 'symbols');
}

/**
 * GET /symbols/:id/prices
 * from / to は YYYY-MM-DD。interval は 1d（既定）または 1w。
 */
export async function fetchSymbolPrices(
  symbolId: string,
  range: { from?: string; to?: string; interval?: ChartInterval } = {},
  fetchImpl?: typeof fetch,
): Promise<DailyPriceDto[]> {
  const params = new URLSearchParams();
  if (range.from) {
    params.set('from', range.from);
  }
  if (range.to) {
    params.set('to', range.to);
  }
  if (range.interval) {
    params.set('interval', range.interval);
  }
  const query = params.toString();
  const path = `/symbols/${encodeURIComponent(symbolId)}/prices${query ? `?${query}` : ''}`;
  const result = await apiFetch<unknown>(path, { method: 'GET' }, fetchImpl);
  return assertArray(result, isDailyPriceDto, 'symbol prices');
}

/**
 * GET /symbols/:id/indicators
 * チャート分析画面で価格と並列取得する。interval / indicators / 期間パラメータ対応。
 */
export async function fetchSymbolIndicators(
  symbolId: string,
  query: {
    from?: string;
    to?: string;
    interval?: ChartInterval;
    indicators?: string;
    smaPeriod?: number;
    emaPeriod?: number;
    rsiPeriod?: number;
    macdFast?: number;
    macdSlow?: number;
    macdSignal?: number;
  } = {},
  fetchImpl?: typeof fetch,
): Promise<IndicatorsResponseDto> {
  const params = new URLSearchParams();
  if (query.from) {
    params.set('from', query.from);
  }
  if (query.to) {
    params.set('to', query.to);
  }
  if (query.interval) {
    params.set('interval', query.interval);
  }
  if (query.indicators) {
    params.set('indicators', query.indicators);
  }
  if (query.smaPeriod !== undefined) {
    params.set('smaPeriod', String(query.smaPeriod));
  }
  if (query.emaPeriod !== undefined) {
    params.set('emaPeriod', String(query.emaPeriod));
  }
  if (query.rsiPeriod !== undefined) {
    params.set('rsiPeriod', String(query.rsiPeriod));
  }
  if (query.macdFast !== undefined) {
    params.set('macdFast', String(query.macdFast));
  }
  if (query.macdSlow !== undefined) {
    params.set('macdSlow', String(query.macdSlow));
  }
  if (query.macdSignal !== undefined) {
    params.set('macdSignal', String(query.macdSignal));
  }
  const qs = params.toString();
  const path = `/symbols/${encodeURIComponent(symbolId)}/indicators${qs ? `?${qs}` : ''}`;
  const result = await apiFetch<unknown>(path, { method: 'GET' }, fetchImpl);
  if (!isIndicatorsResponseDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected indicators response', result);
  }
  return result;
}

/** GET /watchlists */
export async function fetchWatchlists(fetchImpl?: typeof fetch): Promise<WatchlistDto[]> {
  const result = await apiFetch<unknown>('/watchlists', { method: 'GET' }, fetchImpl);
  return assertArray(result, isWatchlistDto, 'watchlists');
}

/** POST /watchlists */
export async function createWatchlist(
  name: string,
  fetchImpl?: typeof fetch,
): Promise<WatchlistDto> {
  const result = await apiFetch<unknown>(
    '/watchlists',
    { method: 'POST', body: JSON.stringify({ name }) },
    fetchImpl,
  );
  if (!isWatchlistDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected watchlist response', result);
  }
  return result;
}

/** DELETE /watchlists/:id */
export async function deleteWatchlist(id: string, fetchImpl?: typeof fetch): Promise<void> {
  await apiFetch<null>(`/watchlists/${id}`, { method: 'DELETE' }, fetchImpl);
}

/** POST /watchlists/:id/items */
export async function addWatchlistItem(
  watchlistId: string,
  symbolId: string,
  fetchImpl?: typeof fetch,
): Promise<WatchlistDto> {
  const result = await apiFetch<unknown>(
    `/watchlists/${watchlistId}/items`,
    { method: 'POST', body: JSON.stringify({ symbolId }) },
    fetchImpl,
  );
  if (!isWatchlistDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected watchlist response', result);
  }
  return result;
}

/** DELETE /watchlists/:id/items/:itemId */
export async function removeWatchlistItem(
  watchlistId: string,
  itemId: string,
  fetchImpl?: typeof fetch,
): Promise<WatchlistDto> {
  const result = await apiFetch<unknown>(
    `/watchlists/${watchlistId}/items/${itemId}`,
    { method: 'DELETE' },
    fetchImpl,
  );
  if (!isWatchlistDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected watchlist response', result);
  }
  return result;
}

/** GET /portfolios */
export async function fetchPortfolios(fetchImpl?: typeof fetch): Promise<PortfolioDto[]> {
  const result = await apiFetch<unknown>('/portfolios', { method: 'GET' }, fetchImpl);
  return assertArray(result, isPortfolioDto, 'portfolios');
}

/** POST /portfolios */
export async function createPortfolio(
  name: string,
  fetchImpl?: typeof fetch,
): Promise<PortfolioDto> {
  const result = await apiFetch<unknown>(
    '/portfolios',
    { method: 'POST', body: JSON.stringify({ name }) },
    fetchImpl,
  );
  if (!isPortfolioDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected portfolio response', result);
  }
  return result;
}

/** DELETE /portfolios/:id */
export async function deletePortfolio(id: string, fetchImpl?: typeof fetch): Promise<void> {
  await apiFetch<null>(`/portfolios/${id}`, { method: 'DELETE' }, fetchImpl);
}

/** POST /portfolios/:id/holdings */
export async function addPortfolioHolding(
  portfolioId: string,
  body: { symbolId: string; quantity: number; averageCost: number },
  fetchImpl?: typeof fetch,
): Promise<PortfolioDto> {
  const result = await apiFetch<unknown>(
    `/portfolios/${portfolioId}/holdings`,
    { method: 'POST', body: JSON.stringify(body) },
    fetchImpl,
  );
  if (!isPortfolioDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected portfolio response', result);
  }
  return result;
}

/** PATCH /portfolios/:id/holdings/:holdingId */
export async function updatePortfolioHolding(
  portfolioId: string,
  holdingId: string,
  body: { quantity?: number; averageCost?: number },
  fetchImpl?: typeof fetch,
): Promise<PortfolioDto> {
  const result = await apiFetch<unknown>(
    `/portfolios/${portfolioId}/holdings/${holdingId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    fetchImpl,
  );
  if (!isPortfolioDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected portfolio response', result);
  }
  return result;
}

/** DELETE /portfolios/:id/holdings/:holdingId */
export async function removePortfolioHolding(
  portfolioId: string,
  holdingId: string,
  fetchImpl?: typeof fetch,
): Promise<PortfolioDto> {
  const result = await apiFetch<unknown>(
    `/portfolios/${portfolioId}/holdings/${holdingId}`,
    { method: 'DELETE' },
    fetchImpl,
  );
  if (!isPortfolioDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected portfolio response', result);
  }
  return result;
}

/** GET /signals */
export async function fetchSignalDefinitions(fetchImpl?: typeof fetch): Promise<SignalDefinitionDto[]> {
  const result = await apiFetch<unknown>('/signals', { method: 'GET' }, fetchImpl);
  return assertArray(result, isSignalDefinitionDto, 'signal definitions');
}

/** POST /signals */
export async function createSignalDefinition(
  body: {
    name: string;
    description?: string;
    strategyType: SignalStrategyType;
    params: SignalStrategyParams;
    isActive?: boolean;
  },
  fetchImpl?: typeof fetch,
): Promise<SignalDefinitionDto> {
  const result = await apiFetch<unknown>(
    '/signals',
    { method: 'POST', body: JSON.stringify(body) },
    fetchImpl,
  );
  if (!isSignalDefinitionDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected signal definition response', result);
  }
  return result;
}

/** PATCH /signals/:id */
export async function updateSignalDefinition(
  id: string,
  body: { name?: string; description?: string; params?: SignalStrategyParams; isActive?: boolean },
  fetchImpl?: typeof fetch,
): Promise<SignalDefinitionDto> {
  const result = await apiFetch<unknown>(
    `/signals/${id}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    fetchImpl,
  );
  if (!isSignalDefinitionDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected signal definition response', result);
  }
  return result;
}

/** DELETE /signals/:id */
export async function deleteSignalDefinition(id: string, fetchImpl?: typeof fetch): Promise<void> {
  await apiFetch<null>(`/signals/${id}`, { method: 'DELETE' }, fetchImpl);
}

/** GET /backtests */
export async function fetchBacktestRuns(fetchImpl?: typeof fetch): Promise<BacktestRunDto[]> {
  const result = await apiFetch<unknown>('/backtests', { method: 'GET' }, fetchImpl);
  return assertArray(result, isBacktestRunDto, 'backtest runs');
}

/** POST /backtests/run */
export async function runBacktest(
  body: {
    signalDefinitionId: string;
    symbolId: string;
    from: string;
    to: string;
    initialCash: number;
    feeRate: number;
    slippageRate: number;
  },
  fetchImpl?: typeof fetch,
): Promise<BacktestRunDto> {
  const result = await apiFetch<unknown>(
    '/backtests/run',
    { method: 'POST', body: JSON.stringify(body) },
    fetchImpl,
  );
  if (!isBacktestRunDto(result)) {
    throw new ApiClientError(500, 'INVALID_RESPONSE', 'Unexpected backtest run response', result);
  }
  return result;
}
