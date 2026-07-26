/**
 * 認証モジュール。
 *
 * JwtModule / Passport / AuthService / JwtStrategy をまとめて提供する。
 * グローバル Guard は AppModule 側で APP_GUARD として登録する。
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { createJwtModuleOptions } from './jwt-config';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      // 文字列 expiresIn（例: 7d）を許容。未設定時は 7 日。
      useFactory: () => createJwtModuleOptions() as never,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
