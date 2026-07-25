import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@market/shared-types';
import { PrismaService } from './prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prismaService: PrismaService) {}

  async getApiHealth(): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'down';

    try {
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

  async getAnalysisHealth(): Promise<HealthResponse> {
    const analysisUrl = process.env.ANALYSIS_URL ?? 'http://localhost:8000';

    try {
      const response = await fetch(`${analysisUrl}/health`);
      if (!response.ok) {
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
