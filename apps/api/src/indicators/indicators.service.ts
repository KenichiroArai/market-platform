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
  createEntryAdviceDto,
  createIndicatorsResponseDto,
  createTrendScoreResponseDto,
  isEntryAdviceDto,
  parseGroupWeightsJson,
  parseIndicatorCatalogQuery,
  parseIndicatorParamOverridesJson,
  resolvedRuleToAnalysisSignal,
  resolveTrendScoreSignalRule,
  scoringCatalogIds,
  specsFromCatalogIds,
  type AnalysisOhlcBar,
  type EntryAdviceDto,
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
      indicatorParams?: string;
    },
  ): Promise<IndicatorsResponseDto> {
    const ids = this.parseCatalogIds(query.indicators);
    const paramOverrides = this.parseIndicatorParamsQuery(query.indicatorParams);
    const specs = specsFromCatalogIds(ids, paramOverrides);
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

    // lookback 未満でも analysis に渡す（ウォームアップ不足は null）。
    // 週足では SMA200 等で必要な本数が年単位になり、上場浅い銘柄で全指標が落ちるのを避ける。
    if (bars.length === 0) {
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
      groupWeights?: string;
      indicatorParams?: string;
    },
  ): Promise<TrendScoreResponseDto> {
    const paramOverrides = this.parseIndicatorParamsQuery(query.indicatorParams);
    const specs = specsFromCatalogIds(scoringCatalogIds(), paramOverrides);
    const groupWeights = this.parseGroupWeightsQuery(query.groupWeights);
    const lookback = computeIndicatorLookback(specs);
    const interval = query.interval === '1w' ? '1w' : '1d';

    const { bars, rangeStartIndex } = await this.pricesService.listWithLookback(
      symbolId,
      { from: query.from, to: query.to, lookback, interval },
    );

    if (bars.length === 0) {
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
      ...(groupWeights ? { groupWeights } : {}),
      ...(paramOverrides && Object.keys(paramOverrides).length > 0
        ? { indicatorParams: paramOverrides }
        : {}),
    });

    return createTrendScoreResponseDto({
      symbolId,
      points: upstream.points.slice(rangeStartIndex),
    });
  }

  /**
   * チャート分析向けエントリー助言（ADR 017）。
   *
   * 指標導出シグナル（未確定時はトレンドスコア閾値）と MM 設定で Analysis に委譲する。
   */
  async getEntryAdviceForSymbol(
    symbolId: string,
    query: {
      from?: string;
      to?: string;
      interval?: '1d' | '1w';
      indicators?: string;
      indicatorParams?: string;
      groupWeights?: string;
      buyThreshold?: string;
      sellThreshold?: string;
      baseDate?: string;
      initialCash?: string;
      tradeSidePolicy?: 'longOnly' | 'longShort';
      moneyManagement?: string;
    },
  ): Promise<EntryAdviceDto> {
    const paramOverrides = this.parseIndicatorParamsQuery(query.indicatorParams);
    const groupWeights = this.parseGroupWeightsQuery(query.groupWeights);
    const buyThreshold = this.parseOptionalNumber(query.buyThreshold, 'buyThreshold');
    const sellThreshold = this.parseOptionalNumber(query.sellThreshold, 'sellThreshold');
    const rule = resolveTrendScoreSignalRule({
      buyThreshold,
      sellThreshold,
    });
    const signalSpec = resolvedRuleToAnalysisSignal(rule);

    const scoreSpecs = specsFromCatalogIds(scoringCatalogIds(), paramOverrides);
    const lookback = computeIndicatorLookback(scoreSpecs);
    const interval = query.interval === '1w' ? '1w' : '1d';

    const { bars, rangeStartIndex } = await this.pricesService.listWithLookback(
      symbolId,
      { from: query.from, to: query.to, lookback, interval },
    );

    if (bars.length === 0) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.INSUFFICIENT_PRICE_DATA,
        message: 'Not enough daily prices for entry advice',
        details: { barCount: 0 },
      });
    }

    const initialCash = this.parsePositiveNumber(query.initialCash ?? '100000', 'initialCash');
    const baseDate =
      query.baseDate?.trim() || bars[bars.length - 1]?.date || bars[rangeStartIndex]?.date;
    const moneyManagement = this.parseMoneyManagementQuery(query.moneyManagement);

    const upstream = await this.postAnalysis<EntryAdviceDto>('/analysis/entry-advice', {
      symbolId,
      bars: bars.map((bar) => ({
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      })),
      signal: signalSpec,
      baseDate,
      initialCash,
      tradeSidePolicy: query.tradeSidePolicy ?? 'longOnly',
      moneyManagement,
      ...(groupWeights ? { groupWeights } : {}),
      ...(paramOverrides && Object.keys(paramOverrides).length > 0
        ? { indicatorParams: paramOverrides }
        : {}),
    });

    if (!isEntryAdviceDto(upstream)) {
      throw new BadGatewayException({
        code: API_ERROR_CODES.ANALYSIS_UPSTREAM_ERROR,
        message: 'Invalid entry advice response from analysis',
      });
    }

    return createEntryAdviceDto(upstream);
  }

  private parseOptionalNumber(raw: string | undefined, field: string): number | undefined {
    if (!raw?.trim()) {
      return undefined;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: `${field} must be a number`,
      });
    }
    return value;
  }

  private parsePositiveNumber(raw: string, field: string): number {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: `${field} must be a positive number`,
      });
    }
    return value;
  }

  private parseMoneyManagementQuery(raw?: string): Record<string, unknown> | null {
    if (!raw?.trim()) {
      return null;
    }
    if (raw.length > 8192) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'moneyManagement query is too long',
      });
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed === null) {
        return null;
      }
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid');
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'Invalid moneyManagement JSON',
      });
    }
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

  private parseIndicatorParamsQuery(raw?: string) {
    if (!raw) {
      return null;
    }
    if (raw.length > 4096) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'indicatorParams query is too long',
      });
    }
    const parsed = parseIndicatorParamOverridesJson(raw);
    if (!parsed) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'Invalid indicatorParams JSON',
      });
    }
    return parsed;
  }

  private parseGroupWeightsQuery(raw?: string) {
    if (!raw) {
      return null;
    }
    if (raw.length > 512) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'groupWeights query is too long',
      });
    }
    const parsed = parseGroupWeightsJson(raw);
    if (!parsed) {
      throw new UnprocessableEntityException({
        code: API_ERROR_CODES.VALIDATION_FAILED,
        message: 'Invalid groupWeights JSON',
      });
    }
    return parsed;
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
