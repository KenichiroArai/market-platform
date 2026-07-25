/**
 * ヘルスチェック用 HTTP エンドポイント。
 *
 * GET /health           … API + DB
 * GET /health/analysis  … FastAPI への依存確認（オーケストレーション境界の検証用）
 */
import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@market/shared-types';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** API / DB の総合ヘルス。 */
  @Get()
  getHealth(): Promise<HealthResponse> {
    return this.healthService.getApiHealth();
  }

  /** 分析 API 疎通専用。Phase 0 のサービス間配線確認に使う。 */
  @Get('analysis')
  getAnalysisHealth(): Promise<HealthResponse> {
    return this.healthService.getAnalysisHealth();
  }
}
