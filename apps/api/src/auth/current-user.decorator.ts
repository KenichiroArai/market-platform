/**
 * req.user（AuthenticatedUser）を Controllers から取り出すデコレータ。
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from './auth.types';

/**
 * ExecutionContext から認証済みユーザーを取り出す。
 * デコレータ本体と単体テストの双方から使う。
 */
export function extractCurrentUser(
  _data: unknown,
  ctx: ExecutionContext,
): AuthenticatedUser {
  const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
  return request.user;
}

export const CurrentUser = createParamDecorator(extractCurrentUser);
