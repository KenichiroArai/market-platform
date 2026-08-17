/**
 * テクニカル指標ゲートウェイ。
 *
 * Prisma から日足を lookback 付きで読み、analysis（FastAPI）に POST して
 * 結果をクライアント向けにトリムして返す。計算ロジック自体は持たない。
 */
import {
  BadGatewayException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  API_ERROR_CODES,
  computeIndicatorLookback,
  createIndicatorsResponseDto,
  createTrendScoreResponseDto,
  parseIndicatorCatalogQuery,
  scoringCatalogIds,
  specsFromCatalogIds,
  type AnalysisOhlcBar,
  type IndicatorCatalogId,
  type IndicatorRequestSpec,
  type IndicatorsResponseDto,
  type TrendScoreResponseDto,
} from '@market/shared-types';
import { PricesService } from '../prices/prices.service';

/** Nest → analysis に渡す内部リクエスト形。 */
type AnalysisComputeRequest = {
  bars: AnalysisOhlcBar[];
  indicators: IndicatorRequestSpec[];
  rangeStartIndex: number;
};

@Injectable()
export class IndicatorsService {
  constructor(private readonly pricesService: PricesService) {}

  /**
   * 銘柄のテクニカル指標を返す。
   *
   * 1. クエリからカタログ ID → IndicatorRequestSpec
   * 2. lookback 付き日足を取得
   * 3. analysis POST /indicators（計算対象が無いときは呼ばない）
   * 4. 表示期間より前を切り、一目の未来点は残す
   */
  async getForSymbol(
    symbolId: string,
    query: {
      from?: string;
      to?: string;
      interval?: '1d' | '1w';
      indicators?: string;
    },
  ): Promise<IndicatorsResponseDto> {
    const ids = this.parseCatalogIds(query.indicators);
    const specs = specsFromCatalogIds(ids);
    const lookback = computeIndicatorLookback(specs);
    const interval = query.interval === '1w' ? '1w' : '1d';

    if (specs.length === 0) {
      return createIndicatorsResponseDto({
        symbolId,
        indicators: [],
        points: [],
      });
    }

    const { bars, rangeStartIndex } = await this.pricesService.listWithLookback(
      symbolId,
      { from: query.from, to: query.to, lookback, interval },
    );

    if (bars.length === 0 || (lookback > 0 && bars.length < lookback)) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.INSUFFICIENT_PRICE_DATA,
        message: 'Not enough daily prices to compute indicators',
        details: { barCount: bars.length, requiredLookback: lookback },
      });
    }

    const analysisBody: AnalysisComputeRequest = {
      bars: bars.map((bar) => ({
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
      indicators: specs,
      rangeStartIndex,
    };

    const upstream = await this.postAnalysis<IndicatorsResponseDto>('/indicators', analysisBody);
    const trimmedPoints = upstream.points.slice(rangeStartIndex);

    return createIndicatorsResponseDto({
      symbolId,
      indicators: specs,
      points: trimmedPoints,
      drawings: upstream.drawings ?? undefined,
    });
  }

  /**
   * 銘柄のトレンドスコアを返す（ADR 007）。
   *
   * 指標セットは正本。チャートトグルとは独立。
   * lookback 付き日足を読み、analysis POST /trend-score に委譲して表示期間へ trim する。
   */
  async getTrendScoreForSymbol(
    symbolId: string,
    query: {
      from?: string;
      to?: string;
      interval?: '1d' | '1w';
    },
  ): Promise<TrendScoreResponseDto> {
    const specs = specsFromCatalogIds(scoringCatalogIds());
    const lookback = computeIndicatorLookback(specs);
    const interval = query.interval === '1w' ? '1w' : '1d';

    const { bars, rangeStartIndex } = await this.pricesService.listWithLookback(
      symbolId,
      { from: query.from, to: query.to, lookback, interval },
    );

    if (bars.length === 0 || (lookback > 0 && bars.length < lookback)) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.INSUFFICIENT_PRICE_DATA,
        message: 'Not enough daily prices to compute trend score',
        details: { barCount: bars.length, requiredLookback: lookback },
      });
    }

    const upstream = await this.postAnalysis<TrendScoreResponseDto>('/trend-score', {
      bars: bars.map((bar) => ({
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
      rangeStartIndex,
    });

    return createTrendScoreResponseDto({
      symbolId,
      points: upstream.points.slice(rangeStartIndex),
    });
  }

  /**
   * クエリ文字列からカタログ ID を取る。
   * 省略時はおすすめ構成。未知 ID・エリオットは VALIDATION_FAILED。
   */
  parseCatalogIds(raw?: string): IndicatorCatalogId[] {
    const parsed = parseIndicatorCatalogQuery(raw);
    if (!parsed.ok) {
      const message =
        parsed.reason === 'unknown'
          ? `Unknown indicator type: ${parsed.token}`
          : parsed.reason === 'disabled'
            ? `Indicator is not computable: ${parsed.token}`
            : 'indicators query must list at least one type';
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message,
      });
    }
    return parsed.ids;
  }

  /** analysis へ POST し、失敗時は ANALYSIS_UPSTREAM_ERROR。 */
  private async postAnalysis<T>(path: string, body: unknown): Promise<T> {
    const analysisUrl = process.env.ANALYSIS_URL ?? 'http://localhost:8000';

    let response: Response;
    try {
      response = await fetch(`${analysisUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new BadGatewayException({
        code: API_ERROR_CODES.ANALYSIS_UPSTREAM_ERROR,
        message: 'Failed to reach analysis service',
        details: {
          error: error instanceof Error ? error.message : 'unknown',
        },
      });
    }

    if (!response.ok) {
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = { statusCode: response.status };
      }
      throw new BadGatewayException({
        code: API_ERROR_CODES.ANALYSIS_UPSTREAM_ERROR,
        message: 'Analysis service returned an error',
        details,
      });
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new BadGatewayException({
        code: API_ERROR_CODES.ANALYSIS_UPSTREAM_ERROR,
        message: 'Analysis service returned invalid JSON',
        details: {
          error: error instanceof Error ? error.message : 'unknown',
        },
      });
    }
  }
}
