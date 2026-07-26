/**
 * 共通 API エラー形式。
 *
 * NestJS と FastAPI が同じ JSON 形でエラーを返すことで、
 * web や呼び出し側が statusCode / code だけで分岐できるようにする。
 */

/** アプリが明示的に使うエラーコード（機械可読）。 */
export const API_ERROR_CODES = {
  /** リクエストボディ・クエリのバリデーション失敗 */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** 認証トークン欠如・不正 */
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  /** メール/パスワード不一致などログイン失敗 */
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  /** 登録時のメール重複 */
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  /** 銘柄が見つからない */
  SYMBOL_NOT_FOUND: 'SYMBOL_NOT_FOUND',
  /** 銘柄の ticker+market が既に存在する */
  SYMBOL_ALREADY_EXISTS: 'SYMBOL_ALREADY_EXISTS',
  /** 予期しないサーバー内部エラー */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** API_ERROR_CODES の値ユニオン。 */
export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * HTTP エラーレスポンスの標準ボディ。
 * details はフィールドエラー配列など、人間向けの付加情報用。
 */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  path?: string;
  timestamp: string;
}

/**
 * ApiErrorBody を組み立てるファクトリ。
 * timestamp 省略時は ISO 8601 の現在時刻を入れる。
 */
export function createApiErrorBody(params: {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  path?: string;
  timestamp?: string;
}): ApiErrorBody {
  const body: ApiErrorBody = {
    statusCode: params.statusCode,
    code: params.code,
    message: params.message,
    timestamp: params.timestamp ?? new Date().toISOString(),
  };

  // 未指定フィールドは省略し、ペイロードを最小にする
  if (params.details !== undefined) {
    body.details = params.details;
  }
  if (params.path !== undefined) {
    body.path = params.path;
  }

  return body;
}

/**
 * 未知の JSON が ApiErrorBody として最低限妥当かを判定する。
 * web の API クライアントでエラー分岐に使う。
 */
export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.statusCode === 'number' &&
    typeof record.code === 'string' &&
    typeof record.message === 'string' &&
    typeof record.timestamp === 'string'
  );
}
