/**
 * NestJS（api）の /health を取得するクライアント関数。
 *
 * サーバーコンポーネントの page から呼び、失敗時は null を返して UI を落とさない。
 * fetchImpl を注入可能にし、単体テストでグローバル fetch に依存しなくてよいようにする。
 */
import type { HealthResponse } from '@market/shared-types';
import { getServerApiBaseUrl } from './api-base-url';

/**
 * @param baseUrl - 省略時は getServerApiBaseUrl()（API_INTERNAL_URL → NEXT_PUBLIC_API_URL → localhost）
 * @param fetchImpl - 既定はグローバル fetch（ブラウザ / Node / Next ランタイム）
 */
export async function fetchApiHealth(
  baseUrl = getServerApiBaseUrl(),
  fetchImpl: typeof fetch = fetch,
): Promise<HealthResponse | null> {
  try {
    // ビルド時キャッシュで古いヘルスを出さないよう、都度取得する
    const response = await fetchImpl(`${baseUrl}/health`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as HealthResponse;
  } catch {
    // ネットワークエラー等は「未接続」として UI 側でメッセージ表示する
    return null;
  }
}
