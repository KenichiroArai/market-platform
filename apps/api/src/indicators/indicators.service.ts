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
  DEFAULT_INDICATOR_PARAMS,
  type AnalysisOhlcBar,
  type IndicatorRequestSpec,
  type IndicatorType,
  type IndicatorsResponseDto,
} from '@market/shared-types';
import { PricesService } from '../prices/prices.service';

/** Nest → analysis に渡す内部リクエスト形。 */
type AnalysisComputeRequest = {
  bars: AnalysisOhlcBar[];
  indicators: IndicatorRequestSpec[];
};

@Injectable()
export class IndicatorsService {
  constructor(private readonly pricesService: PricesService) {}

  /**
   * 銘柄のテクニカル指標を返す。
   *
   * 1. クエリから IndicatorRequestSpec を組み立て
   * 2. lookback 付き日足を取得
   * 3. analysis POST /indicators
   * 4. 表示期間にトリムして symbolId を付与
   */
  async getForSymbol(
    symbolId: string,
    query: {
      from?: string;
      to?: string;
      interval?: '1d' | '1w';
      indicators?: string;
      smaPeriod?: number;
      emaPeriod?: number;
      rsiPeriod?: number;
      macdFast?: number;
      macdSlow?: number;
      macdSignal?: number;
    },
  ): Promise<IndicatorsResponseDto> {
    const specs = this.buildSpecs(query);
    const lookback = computeIndicatorLookback(specs);
    const interval = query.interval === '1w' ? '1w' : '1d';

    const { bars, rangeStartIndex } = await this.pricesService.listWithLookback(
      symbolId,
      { from: query.from, to: query.to, lookback, interval },
    );

    // 計算に必要な最短本数に満たない（ウォームアップすら足りない）場合
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
    };

    const upstream = await this.callAnalysis(analysisBody);

    // lookback 区間を落とし、クライアント指定の from〜to だけ返す
    const trimmedPoints = upstream.points.slice(rangeStartIndex);

    return createIndicatorsResponseDto({
      symbolId,
      indicators: specs,
      points: trimmedPoints,
    });
  }

  /**
   * クエリ文字列から指標スペック配列を組み立てる。
   * indicators 省略時は sma,ema,rsi,macd の全部。
   */
  buildSpecs(query: {
    indicators?: string;
    smaPeriod?: number;
    emaPeriod?: number;
    rsiPeriod?: number;
    macdFast?: number;
    macdSlow?: number;
    macdSignal?: number;
  }): IndicatorRequestSpec[] {
    const requested = this.parseIndicatorTypes(query.indicators);
    const specs: IndicatorRequestSpec[] = [];

    for (const type of requested) {
      if (type === 'sma') {
        specs.push({
          type: 'sma',
          period: query.smaPeriod ?? DEFAULT_INDICATOR_PARAMS.smaPeriod,
        });
      } else if (type === 'ema') {
        specs.push({
          type: 'ema',
          period: query.emaPeriod ?? DEFAULT_INDICATOR_PARAMS.emaPeriod,
        });
      } else if (type === 'rsi') {
        specs.push({
          type: 'rsi',
          period: query.rsiPeriod ?? DEFAULT_INDICATOR_PARAMS.rsiPeriod,
        });
      } else {
        specs.push({
          type: 'macd',
          fast: query.macdFast ?? DEFAULT_INDICATOR_PARAMS.macdFast,
          slow: query.macdSlow ?? DEFAULT_INDICATOR_PARAMS.macdSlow,
          signal: query.macdSignal ?? DEFAULT_INDICATOR_PARAMS.macdSignal,
        });
      }
    }

    return specs;
  }

  /** `sma,ema` 形式をパース。空・未指定は全指標。不正トークンは無視しないで VALIDATION 相当に落とす。 */
  parseIndicatorTypes(raw?: string): IndicatorType[] {
    if (raw === undefined || raw.trim() === '') {
      return ['sma', 'ema', 'rsi', 'macd'];
    }

    const allowed: IndicatorType[] = ['sma', 'ema', 'rsi', 'macd'];
    const parts = raw
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0);

    const types: IndicatorType[] = [];
    for (const part of parts) {
      if (!allowed.includes(part as IndicatorType)) {
        throw new UnprocessableEntityException({
          code: API_ERROR_CODES.VALIDATION_FAILED,
          message: `Unknown indicator type: ${part}`,
        });
      }
      if (!types.includes(part as IndicatorType)) {
        types.push(part as IndicatorType);
      }
    }

    if (types.length === 0) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'indicators query must list at least one type',
      });
    }

    return types;
  }

  /** analysis の POST /indicators を呼び、失敗時は ANALYSIS_UPSTREAM_ERROR。 */
  private async callAnalysis(
    body: AnalysisComputeRequest,
  ): Promise<IndicatorsResponseDto> {
    const analysisUrl = process.env.ANALYSIS_URL ?? 'http://localhost:8000';

    let response: Response;
    try {
      response = await fetch(`${analysisUrl}/indicators`, {
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
      return (await response.json()) as IndicatorsResponseDto;
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
