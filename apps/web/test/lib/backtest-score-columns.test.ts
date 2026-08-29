import {
  dailyGroupCsvHeaders,
  dailyIndicatorCsvHeaders,
  formatGroupCell,
  formatIndicatorCell,
  formatScoreCell,
  groupCsvKey,
  indicatorCsvKey,
  scoreColumnHeader,
  scoreGroupColumns,
  scoreIndicatorColumns,
  shortGroupLabel,
  tradeGroupCsvHeaders,
  tradeIndicatorCsvHeaders,
} from '../../lib/backtest-score-columns';
import { scoringCatalogIds } from '@market/shared-types';

describe('shortGroupLabel', () => {
  it('strips trailing 系', () => {
    expect(shortGroupLabel('トレンド系')).toBe('トレンド');
    expect(shortGroupLabel('モメンタム')).toBe('モメンタム');
  });
});

describe('scoreGroupColumns', () => {
  it('returns category ids with shortened Japanese labels', () => {
    const cols = scoreGroupColumns();
    expect(cols[0]?.id).toBe('trend');
    expect(cols[0]?.label).toBe('トレンド');
    expect(cols.map((c) => c.id)).toContain('momentum');
  });
});

describe('scoreIndicatorColumns', () => {
  it('covers scoring catalog ids', () => {
    const cols = scoreIndicatorColumns();
    expect(cols.map((c) => c.id)).toEqual(scoringCatalogIds());
    expect(cols.every((c) => c.label.length > 0)).toBe(true);
  });
});

describe('format cells', () => {
  it('formats finite scores and leaves blanks for null/NaN', () => {
    expect(formatScoreCell(28.44)).toBe('28.4');
    expect(formatScoreCell(null)).toBe('');
    expect(formatScoreCell(Number.NaN)).toBe('');
  });

  it('reads group and indicator values from breakdown', () => {
    const breakdown = {
      groups: { trend: 10, momentum: null },
      indicators: { rsi: 12.5, macd: null },
    };
    expect(formatGroupCell(breakdown, 'trend')).toBe('10');
    expect(formatGroupCell(breakdown, 'momentum')).toBe('');
    expect(formatGroupCell(null, 'trend')).toBe('');
    expect(formatIndicatorCell(breakdown, 'rsi')).toBe('12.5');
    expect(formatIndicatorCell(breakdown, 'macd')).toBe('');
    expect(formatIndicatorCell(undefined, 'rsi')).toBe('');
  });
});

describe('headers and csv keys', () => {
  it('builds UI headers with entry/exit prefixes', () => {
    expect(scoreColumnHeader('entry', 'トレンド')).toBe('エントリートレンド');
    expect(scoreColumnHeader('exit', 'RSI')).toBe('エグジットRSI');
    expect(scoreColumnHeader('', 'トレンド')).toBe('トレンド');
  });

  it('builds ascii csv keys', () => {
    expect(groupCsvKey('', 'trend')).toBe('group_trend');
    expect(groupCsvKey('entry', 'trend')).toBe('entry_group_trend');
    expect(indicatorCsvKey('', 'rsi')).toBe('rsi');
    expect(indicatorCsvKey('exit', 'rsi')).toBe('exit_rsi');
  });

  it('lists daily and trade csv header sets', () => {
    expect(dailyGroupCsvHeaders()[0]).toBe('group_trend');
    expect(dailyIndicatorCsvHeaders()).toContain(scoringCatalogIds()[0]);
    expect(tradeGroupCsvHeaders()).toEqual(
      expect.arrayContaining(['entry_group_trend', 'exit_group_trend']),
    );
    expect(tradeIndicatorCsvHeaders()[0]).toBe(`entry_${scoringCatalogIds()[0]}`);
  });
});