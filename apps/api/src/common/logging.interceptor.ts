/**
 * HTTP リクエストの完了ログを出すインターセプタ。
 *
 * method / path / status / duration を残し、障害切り分けの手がかりにする。
 * 追加のロギングライブラリは使わず Nest Logger に寄せる。
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const { method, url } = request;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`${method} ${url} ${response.statusCode} ${Date.now() - startedAt}ms`);
        },
        error: () => {
          // ステータスはフィルタ側で上書きされる前でも、所要時間は残す
          const statusCode = response.statusCode || 500;
          this.logger.warn(`${method} ${url} ${statusCode} ${Date.now() - startedAt}ms`);
        },
      }),
    );
  }
}
