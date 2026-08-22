import { BadGatewayException, UnprocessableEntityException } from '@nestjs/common';
import { PricesService } from '../../src/prices/prices.service';
import { IndicatorsService } from '../../src/indicators/indicators.service';

function makeBars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
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
}

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

  it('parses catalog ids and rejects unknowns / elliott / empty', () => {
    expect(service.parseCatalogIds(undefined)).toEqual([
      'sma25',
      'sma75',
      'sma200',
      'macd',
      'ichimoku',
      'rsi',
      'bb',
      'obv',
    ]);
    expect(service.parseCatalogIds(' sma25 , macd ')).toEqual(['sma25', 'macd']);
    expect(service.parseCatalogIds('sma25,sma25')).toEqual(['sma25']);
    expect(() => service.parseCatalogIds('nope')).toThrow(UnprocessableEntityException);
    expect(() => service.parseCatalogIds('elliott')).toThrow(UnprocessableEntityException);
    expect(() => service.parseCatalogIds(' , ')).toThrow(UnprocessableEntityException);
  });

  it('skips analysis when only volume is requested', async () => {
    const result = await service.getForSymbol('s1', { indicators: 'volume' });
    expect(result.points).toEqual([]);
    expect(pricesService.listWithLookback).not.toHaveBeenCalled();
    expect(global.fetch).toBe(originalFetch);
  });

  it('returns trimmed indicator points from analysis', async () => {
    const bars = makeBars(26);
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars,
      rangeStartIndex: 1,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        indicators: [{ id: 'sma25', type: 'sma', params: { period: 25 } }],
        points: bars.map((bar, index) => ({
          date: bar.date,
          values: { sma25: index < 24 ? null : 10 },
        })),
        drawings: {
          fibonacci: {
            high: 2,
            low: 1,
            highDate: '2026-01-02',
            lowDate: '2026-01-01',
            levels: [{ ratio: 0.5, price: 1.5 }],
          },
        },
      }),
    }) as unknown as typeof fetch;

    const result = await service.getForSymbol('s1', { indicators: 'sma25' });
    expect(result.symbolId).toBe('s1');
    expect(result.points).toHaveLength(25);
    expect(result.points[0]?.date).toBe('2026-01-02');
    expect(result.drawings?.fibonacci?.high).toBe(2);
    expect(pricesService.listWithLookback).toHaveBeenCalledWith('s1', {
      from: undefined,
      to: undefined,
      lookback: 25,
      interval: '1d',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://analysis.test/indicators',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('omits null drawings from analysis', async () => {
    const bars = makeBars(26);
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars,
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        indicators: [{ id: 'sma25', type: 'sma', params: { period: 25 } }],
        points: bars.map((bar) => ({ date: bar.date, values: { sma25: 10 } })),
        drawings: null,
      }),
    }) as unknown as typeof fetch;

    const result = await service.getForSymbol('s1', { indicators: 'sma25' });
    expect(result.drawings).toBeUndefined();
  });

  it('passes weekly interval to prices lookback', async () => {
    const bars = makeBars(26);
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars,
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        indicators: [{ id: 'sma25', type: 'sma', params: { period: 25 } }],
        points: bars.map((bar) => ({ date: bar.date, values: { sma25: 10 } })),
      }),
    }) as unknown as typeof fetch;

    await service.getForSymbol('s1', { indicators: 'sma25', interval: '1w' });
    expect(pricesService.listWithLookback).toHaveBeenCalledWith('s1', {
      from: undefined,
      to: undefined,
      lookback: 25,
      interval: '1w',
    });
  });

  it('still computes when bars are fewer than lookback (warmup nulls)', async () => {
    const bars = makeBars(10);
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars,
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        indicators: [{ id: 'sma25', type: 'sma', params: { period: 25 } }],
        points: bars.map((bar) => ({ date: bar.date, values: { sma25: null } })),
      }),
    }) as unknown as typeof fetch;

    const result = await service.getForSymbol('s1', { indicators: 'sma25' });
    expect(result.points).toHaveLength(10);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('throws INSUFFICIENT_PRICE_DATA when bars are empty', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: [],
      rangeStartIndex: 0,
    });

    await expect(service.getForSymbol('s1', { indicators: 'sma25' })).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('maps fetch network failure to ANALYSIS_UPSTREAM_ERROR', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: makeBars(25),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma25' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps non-ok analysis response to ANALYSIS_UPSTREAM_ERROR', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: makeBars(25),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ code: 'INTERNAL_ERROR' }),
    }) as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma25' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps invalid JSON body to ANALYSIS_UPSTREAM_ERROR', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: makeBars(25),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    }) as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma25' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps non-Error invalid JSON rejection', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: makeBars(25),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw 'not-an-error';
      },
    }) as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma25' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('maps non-ok response when error body is not JSON', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: makeBars(25),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    }) as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma25' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('uses default ANALYSIS_URL when env is unset', async () => {
    delete process.env.ANALYSIS_URL;
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: makeBars(25),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ indicators: [], points: [] }),
    }) as unknown as typeof fetch;

    await service.getForSymbol('s1', { indicators: 'sma25' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/indicators',
      expect.any(Object),
    );
  });

  it('maps non-Error fetch rejection', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: makeBars(25),
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockRejectedValue('boom') as unknown as typeof fetch;

    await expect(service.getForSymbol('s1', { indicators: 'sma25' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('IndicatorsService trend score', () => {
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

  it('returns trimmed trend score points from analysis', async () => {
    const bars = makeBars(201);
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars,
      rangeStartIndex: 1,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        points: bars.map((bar) => ({
          date: bar.date,
          score: 10,
          groups: {
            trend: 4,
            momentum: 2,
            oscillator: 1,
            volatility: 1,
            volume: 1,
            cycle: 1,
          },
          indicators: { sma25: 10 },
        })),
      }),
    }) as unknown as typeof fetch;

    const result = await service.getTrendScoreForSymbol('s1', {});
    expect(result.symbolId).toBe('s1');
    expect(result.points).toHaveLength(200);
    expect(result.points[0]?.date).toBe('2026-01-02');
    expect(pricesService.listWithLookback).toHaveBeenCalledWith('s1', {
      from: undefined,
      to: undefined,
      lookback: 200,
      interval: '1d',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://analysis.test/trend-score',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('passes weekly interval for trend score lookback', async () => {
    const bars = makeBars(200);
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars,
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ points: [] }),
    }) as unknown as typeof fetch;

    await service.getTrendScoreForSymbol('s1', { interval: '1w', from: '2026-01-01', to: '2026-06-30' });
    expect(pricesService.listWithLookback).toHaveBeenCalledWith('s1', {
      from: '2026-01-01',
      to: '2026-06-30',
      lookback: 200,
      interval: '1w',
    });
  });

  it('still computes trend score when bars are fewer than lookback', async () => {
    const bars = makeBars(10);
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars,
      rangeStartIndex: 0,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        points: bars.map((bar) => ({
          date: bar.date,
          score: null,
          groups: {
            trend: null,
            momentum: null,
            oscillator: null,
            volatility: null,
            volume: null,
            cycle: null,
          },
          indicators: {},
        })),
      }),
    }) as unknown as typeof fetch;

    const result = await service.getTrendScoreForSymbol('s1', {});
    expect(result.points).toHaveLength(10);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('throws INSUFFICIENT_PRICE_DATA for trend score when bars are empty', async () => {
    (pricesService.listWithLookback as jest.Mock).mockResolvedValue({
      bars: [],
      rangeStartIndex: 0,
    });
    await expect(service.getTrendScoreForSymbol('s1', {})).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
