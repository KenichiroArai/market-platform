import { clearAccessToken, getAccessToken, getDefaultStorage, setAccessToken } from './auth-token';

describe('auth-token', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores and reads access token', () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken('abc');
    expect(getAccessToken()).toBe('abc');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it('returns null when storage is unavailable (SSR)', () => {
    expect(getAccessToken(null)).toBeNull();
    expect(getDefaultStorage(false)).toBeNull();
  });
});
