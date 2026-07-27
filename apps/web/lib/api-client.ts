/**
 * NestJS API 向けの薄い HTTP クライアント。
 *
 * 成功時は JSON、失敗時は ApiErrorBody を投げ、UI が code で分岐できるようにする。
 */
import {
  isApiErrorBody,
  isAuthTokenResponse,
  isAuthUser,
  isPortfolioDto,
  isSymbolDto,
  isWatchlistDto,
  type AuthTokenResponse,
  type AuthUser,
  type LoginRequest,
  type PortfolioDto,
  type RegisterRequest,
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
