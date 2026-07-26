/**
 * JWT ペイロードとリクエスト上のユーザー型。
 *
 * Strategy が validate した値を req.user に載せ、Controller が @CurrentUser で取る。
 */
export interface JwtPayload {
  /** User.id（cuid） */
  sub: string;
  email: string;
}

/** 認証済みリクエストのユーザー要約。 */
export interface AuthenticatedUser {
  id: string;
  email: string;
}
