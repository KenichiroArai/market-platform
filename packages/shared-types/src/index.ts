/**
 * 共有ヘルスチェック型・ヘルパー。
 *
 * NestJS（api）と Next.js（web）の双方が同じ契約でヘルス結果を扱えるようにする。
 * Python（analysis）とは OpenAPI / JSON で同期し、このパッケージには依存させない。
 */

/** サービスの健全性を表すステータス。ok 以外は呼び出し側で degraded 扱いする想定。 */
export type HealthStatus = 'ok' | 'degraded' | 'error';

/**
 * ヘルスチェック API の標準レスポンス形。
 * details は DB や依存サービスなど、診断用の付加情報を入れる。
 */
export interface HealthResponse {
  status: HealthStatus;
  service: string;
  details?: Record<string, unknown>;
}

/** isHealthStatus で許可する値の一覧（実行時バリデーション用）。 */
const HEALTH_STATUSES: readonly HealthStatus[] = ['ok', 'degraded', 'error'];

/**
 * 未知の JSON などが HealthStatus として妥当かを判定する。
 * 文字列以外や未定義のステータスは false。
 */
export function isHealthStatus(value: unknown): value is HealthStatus {
  return typeof value === 'string' && (HEALTH_STATUSES as readonly string[]).includes(value);
}

/**
 * HealthResponse を組み立てるファクトリ。
 * details 未指定時はフィールド自体を省略し、ペイロードを最小にする。
 */
export function createHealthResponse(
  status: HealthStatus,
  service: string,
  details?: Record<string, unknown>,
): HealthResponse {
  if (details === undefined) {
    return { status, service };
  }

  return { status, service, details };
}
