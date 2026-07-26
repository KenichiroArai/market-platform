/**
 * JWT の localStorage 永続化。
 *
 * ADR 001 どおり Bearer トークンをクライアント側に保持する。
 * SSR では window が無いため、読取はクライアント専用。
 */

const TOKEN_KEY = 'market_access_token';

/**
 * 既定の Storage を返す。
 * isBrowser=false で SSR 相当をテストできる。
 */
export function getDefaultStorage(isBrowser = typeof window !== 'undefined'): Storage | null {
  return isBrowser ? window.localStorage : null;
}

/**
 * 保存済み JWT を返す。
 * storage を渡すとテストで SSR（null）を再現できる。
 */
export function getAccessToken(storage: Storage | null = getDefaultStorage()): string | null {
  if (!storage) {
    return null;
  }
  return storage.getItem(TOKEN_KEY);
}

/** JWT を保存する。 */
export function setAccessToken(token: string, storage: Storage = window.localStorage): void {
  storage.setItem(TOKEN_KEY, token);
}

/** JWT を削除する（ログアウト）。 */
export function clearAccessToken(storage: Storage = window.localStorage): void {
  storage.removeItem(TOKEN_KEY);
}
