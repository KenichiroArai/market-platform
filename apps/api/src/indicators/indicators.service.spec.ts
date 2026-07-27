import { BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { PricesService } from '../prices/prices.service';
import { IndicatorsService } from './indicators.service';

describe('IndicatorsService', () => {
  const pricesService = {
    listWithLookback: jest.fn(),
  } as unknown as PricesService;

  let service: IndicatorsService;
  const originalFetch = global.fetch;
  const originalUrl = process.env.ANALYSIS_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IndicatorsService(pricesService);
    process.env.ANALYSIS_URL = 'http://analysis.test';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) {
      delete process.env.ANALYSIS_URL;
    } else {
      process.env.ANALYSIS_URL = originalUrl;
    }
  });

  it('builds default specs and custom periods', () => {
    expect(service.buildSpecs({})).toEqual([
      { type: 'sma', period: 20 },
      { type: 'ema', period: 50 },
      { type: 'rsi', period: 14 },
      { type: 'macd', fast: 12, slow: 26, signal: 9 },
    ]);
    expect(
      service.buildSpecs({
        indicators: 'sma,macd',
        smaPeriod: 10,
        macdFast: 8,
        macdSlow: 17,
        macdSignal: 5,
      }),
    ).toEqual([
      { type: 'sma', period: 10 },
      { type: 'macd', fast: 8, slow: 17, signal: 5 },
    ]);
  });

  it('parses indicator types and rejects unknowns', () => {
    expect(service.parseIndicatorTypes(undefined)).toEqual([
      'sma',
      'ema',
      'rsi',
      'macd',
    ]);
    expect(service.parseIndicatorTypes(' sma , ema ')).toEqual(['sma', 'ema']);
    expect(service.parseIndicatorTypes('sma,sma')).toEqual(['sma']);
    expect(() => service.parseIndicatorTypes('bb')).toThrow(UnprocessableEntityException);
    expect(() => service.parseIndicatorTypes(' , ')).toThrow(UnprocessableEntityException);
  });

  it('returns trimmed indicator points from analysis', async () => {
    const bars = Array.from({ length: 21 }, (_, i) => ({
      id: `p${i}`,
      symbolId: 's1',
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      open: 1,
      high: 1,
      low: 1,
      close: i + 1,
      volume: 0,
      createdAt: '',
      updatedAt: '',
    }));
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars,
      rangeStartIndex: 1,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        indicators: [{ type: 'sma', period: 20 }],
        points: bars.map((bar, index) => ({
          date: bar.date,
          sma: index < 19 ? null : 10,
        })),
      }),
    }) as unknown as typeof fetch;

    const result = await service.getForSymbol('s1', { indicators: 'sma' });
    expect(result.symbolId).toBe('s1');
    expect(result.points).toHaveLength(20);
    expect(result.points[0]?.date).toBe('2026-01-02');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://analysis.test/indicators',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws INSUFFICIENT_PRICE_DATA when bars are too few', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: [{ date: '2026-01-01', close: 1 }],
      rangeStartIndex: 0,
    });

    await expect(service.getForSymbol('s1', { indicators: 'sma', smaPeriod: 20 })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('throws INSUFFICIENT_PRICE_DATA when bars are empty', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: [],
      rangeStartIndex: 0,
    });

    await expect(service.getForSymbol('s1', { indicators: 'sma' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('maps fetch network failure to ANALYSIS_UPSTREAM_ERROR', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`,
        symbolId: 's1',
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 0,
        createdAt: '',
        updatedAt: '',
      })),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps non-ok analysis response to ANALYSIS_UPSTREAM_ERROR', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`,
        symbolId: 's1',
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 0,
        createdAt: '',
        updatedAt: '',
      })),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ code: 'INTERNAL_ERROR' }),
    }) as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps invalid JSON body to ANALYSIS_UPSTREAM_ERROR', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`,
        symbolId: 's1',
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 0,
        createdAt: '',
        updatedAt: '',
      })),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    }) as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps non-Error invalid JSON rejection', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`,
        symbolId: 's1',
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 0,
        createdAt: '',
        updatedAt: '',
      })),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw 'not-an-error';
      },
    }) as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps non-ok response when error body is not JSON', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`,
        symbolId: 's1',
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 0,
        createdAt: '',
        updatedAt: '',
      })),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    }) as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('uses default ANALYSIS_URL when env is unset', async () => {
    delete process.env.ANALYSIS_URL;
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`,
        symbolId: 's1',
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 0,
        createdAt: '',
        updatedAt: '',
      })),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ indicators: [], points: [] }),
    }) as unknown as typeof fetch;

    await service.getForSymbol('s1', { indicators: 'sma' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/indicators',
      expect.any(Object),
    );
  });

  it('maps non-Error fetch rejection', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`,
        symbolId: 's1',
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 0,
        createdAt: '',
        updatedAt: '',
      })),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockRejectedValue('boom') as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
