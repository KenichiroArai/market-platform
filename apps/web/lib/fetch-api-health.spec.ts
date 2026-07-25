import { fetchApiHealth } from './fetch-api-health';

describe('fetchApiHealth', () => {
  const originalUrl = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalUrl;
    }
  });

  it('returns health payload when request succeeds', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'api' }),
    });

    await expect(fetchApiHealth('http://api:3001', fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      status: 'ok',
      service: 'api',
    });
    expect(fetchImpl).toHaveBeenCalledWith('http://api:3001/health', { cache: 'no-store' });
  });

  it('returns null when response is not ok', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false });
    await expect(fetchApiHealth('http://api:3001', fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });

  it('returns null when fetch throws', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(fetchApiHealth('http://api:3001', fetchImpl as unknown as typeof fetch)).resolves.toBeNull();
  });

  it('uses NEXT_PUBLIC_API_URL by default', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://custom:3001';
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'api' }),
    });

    await fetchApiHealth(undefined, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith('http://custom:3001/health', { cache: 'no-store' });
  });

  it('falls back to localhost when env is unset', async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'api' }),
    });

    await fetchApiHealth(undefined, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:3001/health', { cache: 'no-store' });
  });

  it('uses global fetch when fetchImpl is omitted', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'api' }),
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    try {
      await expect(fetchApiHealth('http://localhost:3001')).resolves.toEqual({
        status: 'ok',
        service: 'api',
      });
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/health', { cache: 'no-store' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
