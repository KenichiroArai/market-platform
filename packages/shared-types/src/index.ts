export type HealthStatus = 'ok' | 'degraded' | 'error';

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  details?: Record<string, unknown>;
}

const HEALTH_STATUSES: readonly HealthStatus[] = ['ok', 'degraded', 'error'];

export function isHealthStatus(value: unknown): value is HealthStatus {
  return typeof value === 'string' && (HEALTH_STATUSES as readonly string[]).includes(value);
}

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
