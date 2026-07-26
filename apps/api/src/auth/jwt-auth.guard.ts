/**
 * グローバル JWT ガード。
 *
 * @Public() が付いたハンドラはスキップし、それ以外は Bearer トークンを必須にする。
 */
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../common/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 公開エンドポイントはトークン検証を行わない
    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
