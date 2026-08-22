import { getApiBaseUrl } from '../../lib/api-base-url';

describe('getApiBaseUrl', () => {
  const original = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = original;
    }
  });

  it('uses NEXT_PUBLIC_API_URL when set', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://custom:3001';
    expect(getApiBaseUrl()).toBe('http://custom:3001');
  });

  it('falls back to localhost', () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });
});
