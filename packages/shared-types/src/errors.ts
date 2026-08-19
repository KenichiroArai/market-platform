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
  /** プロバイダから銘柄メタデータ（quote）を取得できない */
  SYMBOL_QUOTE_NOT_FOUND: 'SYMBOL_QUOTE_NOT_FOUND',
  /** ウォッチリストが見つからない（他人所有も含む） */
  WATCHLIST_NOT_FOUND: 'WATCHLIST_NOT_FOUND',
  /** ウォッチリスト内の銘柄行が見つからない */
  WATCHLIST_ITEM_NOT_FOUND: 'WATCHLIST_ITEM_NOT_FOUND',
  /** 同一ウォッチリストに同じ銘柄が既にある */
  WATCHLIST_ITEM_ALREADY_EXISTS: 'WATCHLIST_ITEM_ALREADY_EXISTS',
  /** ポートフォリオが見つからない（他人所有も含む） */
  PORTFOLIO_NOT_FOUND: 'PORTFOLIO_NOT_FOUND',
  /** 保有行が見つからない */
  HOLDING_NOT_FOUND: 'HOLDING_NOT_FOUND',
  /** 同一ポートフォリオに同じ銘柄の保有が既にある */
  HOLDING_ALREADY_EXISTS: 'HOLDING_ALREADY_EXISTS',
  /** 日足本数が指標計算の最短要件を満たさない */
  INSUFFICIENT_PRICE_DATA: 'INSUFFICIENT_PRICE_DATA',
  /** 分析 API（FastAPI）への内部 HTTP が失敗した */
  ANALYSIS_UPSTREAM_ERROR: 'ANALYSIS_UPSTREAM_ERROR',
  /** シグナル定義が見つからない（他人所有も含む） */
  SIGNAL_DEFINITION_NOT_FOUND: 'SIGNAL_DEFINITION_NOT_FOUND',
  /** 同一ユーザー内でシグナル定義名が重複した */
  SIGNAL_DEFINITION_ALREADY_EXISTS: 'SIGNAL_DEFINITION_ALREADY_EXISTS',
  /** バックテスト実行が見つからない（他人所有も含む） */
  BACKTEST_RUN_NOT_FOUND: 'BACKTEST_RUN_NOT_FOUND',
  /** 指標セットが見つからない（他人所有も含む） */
  INDICATOR_SET_NOT_FOUND: 'INDICATOR_SET_NOT_FOUND',
  /** 同一ユーザー内で指標セット名が重複した */
  INDICATOR_SET_ALREADY_EXISTS: 'INDICATOR_SET_ALREADY_EXISTS',
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
