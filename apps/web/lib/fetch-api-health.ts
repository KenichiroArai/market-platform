import type { HealthResponse } from '@market/shared-types';

export async function fetchApiHealth(
  baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  fetchImpl: typeof fetch = fetch,
): Promise<HealthResponse | null> {
  try {
    const response = await fetchImpl(`${baseUrl}/health`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as HealthResponse;
  } catch {
    return null;
  }
}
