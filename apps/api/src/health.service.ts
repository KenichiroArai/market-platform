/**
 * ヘルスチェックのビジネスロジック。
 *
 * - 自サービス + PostgreSQL の生死
 * - 分析 API（FastAPI）への疎通
 * をまとめて返す。Controller は HTTP マッピングのみ担当する。
 */
import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@market/shared-types';
import { PrismaService } from './prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * API 自身と DB の状態。
   * DB に届かない場合は status=degraded（プロセスは生きているが依存が落ちている）。
   */
  async getApiHealth(): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'down';

    try {
      // スキーマにモデルが無くても通る軽量な疎通確認
      await this.prismaService.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: 'api',
      details: { database },
    };
  }

  /**
   * analysis サービスへの内部 HTTP 疎通確認。
   * Docker 内では ANALYSIS_URL=http://analysis:8000 を想定。
   */
  async getAnalysisHealth(): Promise<HealthResponse> {
    const analysisUrl = process.env.ANALYSIS_URL ?? 'http://localhost:8000';

    try {
      const response = await fetch(`${analysisUrl}/health`);
      if (!response.ok) {
        // 接続はできたが 5xx 等で失敗しているケース
        return {
          status: 'degraded',
          service: 'api',
          details: {
            analysis: 'down',
            statusCode: response.status,
          },
        };
      }

      const body = (await response.json()) as HealthResponse;
      return {
        status: 'ok',
        service: 'api',
        details: { analysis: body },
      };
    } catch (error) {
      // DNS 失敗・接続拒否など、レスポンス自体が無いケース
      return {
        status: 'degraded',
        service: 'api',
        details: {
          analysis: 'down',
          error: error instanceof Error ? error.message : 'unknown',
        },
      };
    }
  }
}
