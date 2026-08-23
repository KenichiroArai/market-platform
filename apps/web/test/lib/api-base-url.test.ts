import { getApiBaseUrl, getServerApiBaseUrl } from '../../lib/api-base-url';

describe('getApiBaseUrl', () => {
  const originalPublic = process.env.NEXT_PUBLIC_API_URL;
  const originalInternal = process.env.API_INTERNAL_URL;

  afterEach(() => {
    if (originalPublic === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalPublic;
    }
    if (originalInternal === undefined) {
      delete process.env.API_INTERNAL_URL;
    } else {
      process.env.API_INTERNAL_URL = originalInternal;
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

describe('getServerApiBaseUrl', () => {
  const originalPublic = process.env.NEXT_PUBLIC_API_URL;
  const originalInternal = process.env.API_INTERNAL_URL;

  afterEach(() => {
    if (originalPublic === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalPublic;
    }
    if (originalInternal === undefined) {
      delete process.env.API_INTERNAL_URL;
    } else {
      process.env.API_INTERNAL_URL = originalInternal;
    }
  });

  it('prefers API_INTERNAL_URL when set', () => {
    process.env.API_INTERNAL_URL = 'http://api:3001';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001';
    expect(getServerApiBaseUrl()).toBe('http://api:3001');
  });

  it('falls back to getApiBaseUrl when API_INTERNAL_URL is unset', () => {
    delete process.env.API_INTERNAL_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://custom:3001';
    expect(getServerApiBaseUrl()).toBe('http://custom:3001');
  });

  it('falls back to localhost when both env vars are unset', () => {
    delete process.env.API_INTERNAL_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(getServerApiBaseUrl()).toBe('http://localhost:3001');
  });
});
