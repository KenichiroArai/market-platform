/**
 * NestJS API 向けの薄い HTTP クライアント。
 *
 * 成功時は JSON、失敗時は ApiErrorBody を投げ、UI が code で分岐できるようにする。
 */
import {
  isApiErrorBody,
  isAuthTokenResponse,
  isAuthUser,
  type AuthTokenResponse,
  type AuthUser,
  type LoginRequest,
  type RegisterRequest,
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

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(payload)) {
      throw new ApiClientError(payload.statusCode, payload.code, payload.message, payload);
    }
    throw new ApiClientError(response.status, 'HTTP_ERROR', 'Request failed', payload);
  }

  return payload as T;
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
