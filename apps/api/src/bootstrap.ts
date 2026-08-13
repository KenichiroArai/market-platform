/**
 * Nest アプリの起動処理本体。
 *
 * ValidationPipe / 例外フィルタ / リクエストログ / Swagger を配線し、
 * JWT_SECRET 未設定時は起動前に失敗させる。
 */
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { readAppVersion } from './app-version';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { LoggingInterceptor } from './common/logging.interceptor';

/**
 * 必須環境変数を検証する。
 * 秘密鍵のフォールバックは置かず、誤った本番デプロイを防ぐ。
 */
export function assertRequiredEnv(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
}

/**
 * OpenAPI ドキュメントを /docs に公開する。
 * Nest と FastAPI の契約を並べて確認できるようにする。
 */
export function setupSwagger(app: {
  use?: unknown;
}): void {
  const nestApp = app as Parameters<typeof SwaggerModule.setup>[1];
  const config = new DocumentBuilder()
    .setTitle('market-api')
    .setDescription('market-platform NestJS Web API（Phase 2 Market Data）')
    .setVersion(readAppVersion())
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(nestApp, config);
  SwaggerModule.setup('docs', nestApp, document);
}

/**
 * HTTP サーバーを起動する。
 * @returns 生成した Nest アプリケーション（テストや graceful shutdown 用）
 */
export async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule, {
    // LOG_LEVEL は Nest のロガー配列指定に使う（未設定時は既定）
    logger: resolveNestLogLevels(process.env.LOG_LEVEL),
  });

  // web（別オリジン）からのブラウザアクセスを許可する
  app.enableCors();

  // whitelist: DTO に無いプロパティを落とす。forbid は Phase 1 では厳しすぎるため使わない。
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  setupSwagger(app);

  // 未設定時は設計どおり 3001（docker-compose / README と揃える）
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);

  Logger.log(`API listening on ${port}`, 'Bootstrap');
  return app;
}

/**
 * LOG_LEVEL 環境変数を Nest の logger オプションに変換する。
 * カンマ区切り（例: error,warn）または単一レベルを受け付ける。
 */
export function resolveNestLogLevels(
  logLevel: string | undefined,
): ('log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal')[] | undefined {
  if (!logLevel) {
    return undefined;
  }

  const allowed = new Set(['log', 'error', 'warn', 'debug', 'verbose', 'fatal']);
  const levels = logLevel
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal' =>
      allowed.has(part),
    );

  return levels.length > 0 ? levels : undefined;
}
