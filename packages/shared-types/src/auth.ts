/**
 * 認証 API の共有 DTO。
 *
 * NestJS のリクエスト/レスポンスと web のフォーム・クライアントが同じ形を共有する。
 * パスワードはレスポンスに含めない（AuthUser には email と id のみ）。
 */

/** ユーザー登録リクエスト。 */
export interface RegisterRequest {
  email: string;
  password: string;
}

/** ログインリクエスト。 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 認証成功時に返すユーザー要約（機密情報なし）。 */
export interface AuthUser {
  id: string;
  email: string;
}

/**
 * 登録・ログイン成功時のレスポンス。
 * accessToken は JWT。web は localStorage に保存し Bearer で送る。
 */
export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
}

/**
 * AuthTokenResponse を組み立てるファクトリ。
 * tokenType は常に Bearer に固定する（将来の拡張余地を残しつつ契約を単純化）。
 */
export function createAuthTokenResponse(accessToken: string, user: AuthUser): AuthTokenResponse {
  return {
    accessToken,
    tokenType: 'Bearer',
    user,
  };
}

/**
 * 未知の JSON が AuthUser として妥当かを判定する。
 */
export function isAuthUser(value: unknown): value is AuthUser {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.email === 'string';
}

/**
 * 未知の JSON が AuthTokenResponse として妥当かを判定する。
 */
export function isAuthTokenResponse(value: unknown): value is AuthTokenResponse {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.accessToken === 'string' &&
    record.tokenType === 'Bearer' &&
    isAuthUser(record.user)
  );
}
