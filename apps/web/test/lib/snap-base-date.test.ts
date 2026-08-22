import { snapBaseDate } from '../../lib/snap-base-date';

describe('snapBaseDate', () => {
  const points = [{ date: '2026-01-02' }, { date: '2026-01-05' }, { date: '2026-01-09' }];

  it('returns null for empty input or empty points', () => {
    expect(snapBaseDate([], '2026-01-05')).toBeNull();
    expect(snapBaseDate(points, '')).toBeNull();
  });

  it('returns the exact date when it matches a bar', () => {
    expect(snapBaseDate(points, '2026-01-05')).toBe('2026-01-05');
  });

  it('snaps to the previous bar date when input falls between bars', () => {
    expect(snapBaseDate(points, '2026-01-07')).toBe('2026-01-05');
  });

  it('snaps to the first bar when input is before all bars', () => {
    expect(snapBaseDate(points, '2025-12-01')).toBe('2026-01-02');
  });

  it('snaps to the last previous bar when input is after all bars', () => {
    expect(snapBaseDate(points, '2026-02-01')).toBe('2026-01-09');
  });
});
