/**
 * API ベース URL を解決する。
 *
 * - getApiBaseUrl: ブラウザから見える URL（NEXT_PUBLIC_API_URL）
 * - getServerApiBaseUrl: SSR / サーバー側 fetch 用（Docker では API_INTERNAL_URL）
 */

const DEFAULT_API_BASE_URL = 'http://localhost:3001';

/**
 * ブラウザ向け API ベース URL。
 * NEXT_PUBLIC_* はクライアントにも埋め込まれる。
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL;
}

/**
 * サーバー側 fetch 用の API ベース URL。
 *
 * Docker Compose では web コンテナ内の localhost は api に届かないため、
 * API_INTERNAL_URL（例: http://api:3001）を優先する。
 * 未設定時は getApiBaseUrl() にフォールバック（ホスト上の pnpm dev など）。
 */
export function getServerApiBaseUrl(): string {
  return process.env.API_INTERNAL_URL ?? getApiBaseUrl();
}
