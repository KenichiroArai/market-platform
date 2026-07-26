/**
 * ヘルスチェック用 HTTP エンドポイント。
 *
 * GET /health           … API + DB
 * GET /health/analysis  … FastAPI への依存確認（オーケストレーション境界の検証用）
 */
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@market/shared-types';
import { Public } from './common/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** API / DB の総合ヘルス。 */
  @Get()
  @ApiOkResponse({ description: 'API and database health' })
  getHealth(): Promise<HealthResponse> {
    return this.healthService.getApiHealth();
  }

  /** 分析 API 疎通専用。サービス間配線確認に使う。 */
  @Get('analysis')
  @ApiOkResponse({ description: 'Analysis upstream health (proxied)' })
  getAnalysisHealth(): Promise<HealthResponse> {
    return this.healthService.getAnalysisHealth();
  }
}
