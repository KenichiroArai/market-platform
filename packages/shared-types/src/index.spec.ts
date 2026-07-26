import {
  API_ERROR_CODES,
  createApiErrorBody,
  createAuthTokenResponse,
  createHealthResponse,
  isApiErrorBody,
  isAuthTokenResponse,
  isAuthUser,
  isHealthStatus,
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
