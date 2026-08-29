import { strFromU8, unzipSync } from 'fflate';
import type {
  BacktestRunDto,
  BacktestTradeDto,
  DailyPriceDto,
} from '@market/shared-types';
import { scoringCatalogIds } from '@market/shared-types';
import {
  buildBacktestExportZip,
  buildDailyDetailRows,
  buildPricesCsv,
  buildSummaryCsv,
  buildTradesCsv,
  downloadBacktestExportZip,
  toCsv,
} from '../../lib/backtest-export';

function makePrice(overrides: Partial<DailyPriceDto> & Pick<DailyPriceDto, 'date'>): DailyPriceDto {
  return {
    id: `p_${overrides.date}`,
    symbolId: 'sym_1',
    open: 100,
    high: 110,
    low: 90,
    close: 105,
    volume: 1000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTrade(overrides: Partial<BacktestTradeDto> = {}): BacktestTradeDto {
  return {
    id: 'tr_1',
    backtestRunId: 'run_1',
    symbolId: 'sym_1',
    entryDate: '2026-01-02',
    exitDate: '2026-01-03',
    entryPrice: 100,
    exitPrice: 110,
    quantity: 1,
    side: 'buy',
    grossPnl: 10,
    feeAmount: 0.1,
    slippageAmount: 0.05,
    netPnl: 9.85,
    entryReason: 'rsi_oversold',
    exitReason: 'rsi_overbought',
    entryScore: 28.4,
    exitScore: 72.1,
    entryScoreBreakdown: null,
    exitScoreBreakdown: null,
    ...overrides,
  };
}

function makeRun(overrides: Partial<BacktestRunDto> = {}): BacktestRunDto {
  return {
    id: 'run_1',
    userId: 'u_1',
    indicatorSetId: 'set_1',
    signalDefinitionId: null,
    strategyType: 'rsiThreshold',
    params: { period: 14, lower: 30, upper: 70 },
    symbolId: 'sym_1',
    fromDate: '2026-01-01',
    toDate: '2026-01-05',
    initialCash: 1_000_000,
    feeRate: 0.001,
    slippageRate: 0.0005,
    summary: {
      finalEquity: 1_010_000,
      totalReturnRate: 0.01,
      maxDrawdownRate: 0.02,
      totalTrades: 1,
      winRate: 1,
      sharpeRatio: 1.5,
      profitFactor: 2,
      buyHoldReturnRate: 0.005,
      buyHoldFinalEquity: 1_005_000,
    },
    trades: [makeTrade()],
    equityPoints: [
      {
        id: 'eq_1',
        backtestRunId: 'run_1',
        date: '2026-01-01',
        cash: 1_000_000,
        positionValue: 0,
        equity: 1_000_000,
        drawdownRate: 0,
        decisionScore: null,
        scoreBreakdown: null,
      },
      {
        id: 'eq_2',
        backtestRunId: 'run_1',
        date: '2026-01-02',
        cash: 900_000,
        positionValue: 100_000,
        equity: 1_000_000,
        drawdownRate: 0,
        decisionScore: 28.44,
        scoreBreakdown: null,
      },
      {
        id: 'eq_3',
        backtestRunId: 'run_1',
        date: '2026-01-03',
        cash: 1_010_000,
        positionValue: 0,
        equity: 1_010_000,
        drawdownRate: 0,
        decisionScore: 72,
        scoreBreakdown: null,
      },
    ],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toCsv', () => {
  it('adds UTF-8 BOM and joins with CRLF', () => {
    const csv = toCsv(['a', 'b'], [[1, 2]]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1)).toBe('a,b\r\n1,2');
  });

  it('escapes commas, quotes, and newlines', () => {
    const csv = toCsv(['h'], [['a,b'], ['say "hi"'], ['line1\nline2']]);
    expect(csv.slice(1)).toBe('h\r\n"a,b"\r\n"say ""hi"""\r\n"line1\nline2"');
  });

  it('treats null and undefined as empty cells', () => {
    const csv = toCsv(['a', 'b'], [[null, undefined]]);
    expect(csv.slice(1)).toBe('a,b\r\n,');
  });
});

describe('buildDailyDetailRows', () => {
  it('joins prices by date and marks buy/sell events', () => {
    const run = makeRun({
      trades: [
        makeTrade({ entryDate: '2026-01-02', exitDate: '2026-01-03' }),
        makeTrade({
          id: 'tr_2',
          entryDate: '2026-01-03',
          exitDate: '2026-01-03',
        }),
      ],
    });
    const prices = [
      makePrice({ date: '2026-01-02', open: 10, high: 11, low: 9, close: 10.5, volume: 50 }),
    ];
    const { headers, rows } = buildDailyDetailRows(run, prices);
    expect(headers).toContain('tradeEvent');
    expect(headers).toContain('group_trend');
    expect(headers).toContain(scoringCatalogIds()[0]);
    expect(rows[0].slice(0, 13)).toEqual([
      '2026-01-01',
      1_000_000,
      0,
      1_000_000,
      0,
      '',
      '',
      '',
      '',
      '',
      0,
      '',
      '',
    ]);
    expect(rows[1][5]).toBe(10);
    expect(rows[1][10]).toBe(1);
    expect(rows[1][11]).toBe('buy');
    expect(rows[1][12]).toBe('28.4');
    expect(rows[2][11]).toBe('buy;sell');
    expect(rows[2][12]).toBe('72');
  });

  it('marks sell-only days', () => {
    const run = makeRun({
      trades: [makeTrade({ entryDate: '2026-01-01', exitDate: '2026-01-02' })],
      equityPoints: [
        {
          id: 'eq_2',
          backtestRunId: 'run_1',
          date: '2026-01-02',
          cash: 1,
          positionValue: 0,
          equity: 1,
          drawdownRate: 0,
          decisionScore: Number.NaN,
          scoreBreakdown: null,
        },
      ],
    });
    const { rows } = buildDailyDetailRows(run, []);
    expect(rows[0][11]).toBe('sell');
    expect(rows[0][12]).toBe('');
  });

  it('flattens scoreBreakdown into group and indicator columns', () => {
    const catalogId = scoringCatalogIds()[0];
    const run = makeRun({
      equityPoints: [
        {
          id: 'eq_bd',
          backtestRunId: 'run_1',
          date: '2026-01-02',
          cash: 1,
          positionValue: 0,
          equity: 1,
          drawdownRate: 0,
          decisionScore: 40,
          scoreBreakdown: {
            groups: { trend: 12.5, momentum: null },
            indicators: { [catalogId]: 3.2 },
          },
        },
      ],
    });
    const { headers, rows } = buildDailyDetailRows(run, []);
    const trendIdx = headers.indexOf('group_trend');
    const catalogIdx = headers.indexOf(catalogId);
    expect(rows[0][trendIdx]).toBe('12.5');
    expect(rows[0][catalogIdx]).toBe('3.2');
  });
});

describe('buildSummaryCsv', () => {
  it('includes strategy label and optional symbol/set names', () => {
    const csv = buildSummaryCsv(makeRun(), 'AAPL', 'RSIセット');
    expect(csv).toContain('RSI閾値 14（≤30 / ≥70）');
    expect(csv).toContain('AAPL');
    expect(csv).toContain('RSIセット');
  });

  it('uses empty strings when optional names are omitted', () => {
    const csv = buildSummaryCsv(makeRun({ indicatorSetId: null }));
    const dataLine = csv.slice(1).split('\r\n')[1];
    expect(dataLine.split(',')[2]).toBe('');
    expect(dataLine.split(',')[4]).toBe('');
  });
});

describe('buildTradesCsv', () => {
  it('writes reason labels without scores and flattens breakdowns', () => {
    const catalogId = scoringCatalogIds()[0];
    const run = makeRun({
      trades: [
        makeTrade({
          entryScoreBreakdown: {
            groups: { trend: 1 },
            indicators: { [catalogId]: 0.85 },
          },
          exitScoreBreakdown: {
            groups: { trend: -1 },
            indicators: { [catalogId]: null },
          },
        }),
      ],
    });
    const csv = buildTradesCsv(run);
    expect(csv).toContain('RSI売られすぎ');
    expect(csv).toContain('RSI買われすぎ');
    expect(csv).not.toContain('RSI売られすぎ（28.4）');
    expect(csv).toContain('entry_group_trend');
    expect(csv).toContain('exit_group_trend');
    expect(csv).toContain(`entry_${catalogId}`);
    expect(csv).toContain(`exit_${catalogId}`);
    expect(csv).toContain('0.9');
    const header = csv.slice(1).split('\r\n')[0];
    const row = csv.slice(1).split('\r\n')[1];
    const groupIdx = header.split(',').indexOf('entry_group_trend');
    expect(row.split(',')[groupIdx]).toBe('1');
  });

  it('leaves score columns empty when breakdowns are missing', () => {
    const csv = buildTradesCsv(makeRun());
    const header = csv.slice(1).split('\r\n')[0];
    const row = csv.slice(1).split('\r\n')[1];
    const entryIdx = header.split(',').indexOf(`entry_${scoringCatalogIds()[0]}`);
    expect(row.split(',')[entryIdx]).toBe('');
    const groupIdx = header.split(',').indexOf('entry_group_trend');
    expect(row.split(',')[groupIdx]).toBe('');
  });
});

describe('buildPricesCsv', () => {
  it('exports OHLC columns', () => {
    const csv = buildPricesCsv([makePrice({ date: '2026-01-01', open: 1, high: 2, low: 0.5, close: 1.5, volume: 9 })]);
    expect(csv.slice(1)).toBe('date,open,high,low,close,volume\r\n2026-01-01,1,2,0.5,1.5,9');
  });
});

describe('buildBacktestExportZip', () => {
  it('produces the expected file names', () => {
    const zip = buildBacktestExportZip({
      run: makeRun(),
      prices: [makePrice({ date: '2026-01-02' })],
      symbolCode: 'AAPL',
      indicatorSetName: 'セット',
    });
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual([
      'daily_detail.csv',
      'prices.csv',
      'summary.csv',
      'trades.csv',
    ]);
    expect(strFromU8(files['summary.csv']!).startsWith('\uFEFF')).toBe(true);
    expect(strFromU8(files['daily_detail.csv']!)).toContain('2026-01-02');
  });
});

describe('downloadBacktestExportZip', () => {
  it('creates a blob download link and revokes the object URL', () => {
    const click = jest.fn();
    const createElement = jest.spyOn(document, 'createElement').mockImplementation(() => {
      return { click, href: '', download: '' } as unknown as HTMLAnchorElement;
    });
    const createObjectURL = jest.fn(() => 'blob:mock');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    downloadBacktestExportZip({
      run: makeRun(),
      prices: [],
      symbolCode: null,
      indicatorSetName: null,
    });

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    createElement.mockRestore();
  });
});