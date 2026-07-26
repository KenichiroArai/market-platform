/**
 * 例外を共通 ApiErrorBody 形式に正規化するグローバルフィルタ。
 *
 * HttpException（バリデーション含む）と未知エラーの双方を扱い、
 * web / 他クライアントが statusCode + code で分岐できるようにする。
 */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { API_ERROR_CODES, createApiErrorBody } from '@market/shared-types';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, code, message, details } = this.normalize(exception);

    // 5xx は運用調査用にサーバーログへ残す（クライアントには stack を出さない）
    if (statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'unknown error',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(statusCode).json(
      createApiErrorBody({
        statusCode,
        code,
        message,
        details,
        path: request.url,
      }),
    );
  }

  /**
   * Nest の例外オブジェクトを ApiErrorBody の部品に変換する。
   * BadRequest（ValidationPipe）は VALIDATION_FAILED、その他 HttpException は status から推測する。
   */
  private normalize(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      // ValidationPipe は { message: string[], statusCode, error } を返すことが多い
      if (typeof payload === 'object' && payload !== null) {
        const record = payload as Record<string, unknown>;
        const rawMessage = record.message;
        const message = Array.isArray(rawMessage)
          ? 'Validation failed'
          : typeof rawMessage === 'string'
            ? rawMessage
            : exception.message;

        // 明示 code（AUTH_EMAIL_TAKEN 等）を優先し、無ければ status から既定コードを当てる
        const code =
          typeof record.code === 'string'
            ? record.code
            : statusCode === HttpStatus.BAD_REQUEST
              ? API_ERROR_CODES.VALIDATION_FAILED
              : statusCode === HttpStatus.UNAUTHORIZED
                ? API_ERROR_CODES.AUTH_UNAUTHORIZED
                : `HTTP_${statusCode}`;

        const details = Array.isArray(rawMessage)
          ? rawMessage
          : record.details !== undefined
            ? record.details
            : undefined;

        return { statusCode, code, message, details };
      }

      return {
        statusCode,
        code: statusCode === HttpStatus.UNAUTHORIZED ? API_ERROR_CODES.AUTH_UNAUTHORIZED : `HTTP_${statusCode}`,
        message: exception.message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal server error',
    };
  }
}
