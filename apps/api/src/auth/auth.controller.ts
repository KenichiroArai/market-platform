/**
 * 認証 HTTP エンドポイント。
 *
 * register / login は公開、/me は JwtAuthGuard（グローバル）で保護する。
 */
import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthTokenResponse, AuthUser } from '@market/shared-types';
import { Public } from '../common/public.decorator';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 新規登録。成功時は JWT を返す。 */
  @Public()
  @Post('register')
  @ApiOkResponse({ description: 'Registered and issued JWT' })
  register(@Body() dto: RegisterDto): Promise<AuthTokenResponse> {
    return this.authService.register(dto);
  }

  /** ログイン。失敗時は共通エラー（AUTH_INVALID_CREDENTIALS）。 */
  @Public()
  @Post('login')
  @ApiOkResponse({ description: 'Logged in and issued JWT' })
  login(@Body() dto: LoginDto): Promise<AuthTokenResponse> {
    return this.authService.login(dto);
  }

  /** 現在のユーザー。Bearer 必須。 */
  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ description: 'Current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUser> {
    return this.authService.getMe(user.id);
  }
}
