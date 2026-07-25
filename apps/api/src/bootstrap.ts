/**
 * Nest アプリの起動処理本体。
 *
 * main.ts から呼ばれ、CORS 有効化とポート待ち受けまでを行う。
 * テストでは NestFactory をモックしてこの関数だけを検証する。
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * HTTP サーバーを起動する。
 * @returns 生成した Nest アプリケーション（テストや graceful shutdown 用）
 */
export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // web（別オリジン）からのブラウザアクセスを許可する
  app.enableCors();

  // 未設定時は設計どおり 3001（docker-compose / README と揃える）
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  return app;
}
