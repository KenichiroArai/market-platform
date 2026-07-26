/**
 * API ベース URL を解決する。
 * ブラウザ / SSR 双方で NEXT_PUBLIC_API_URL を使う。
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}
