/**
 * JWT 設定のヘルパー。
 *
 * AuthModule の JwtModule.registerAsync から呼び、テストしやすくする。
 */
export function createJwtModuleOptions(
  env: NodeJS.ProcessEnv = process.env,
): { secret: string; signOptions: { expiresIn: string } } {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  return {
    secret,
    signOptions: {
      expiresIn: env.JWT_EXPIRES_IN ?? '7d',
    },
  };
}
