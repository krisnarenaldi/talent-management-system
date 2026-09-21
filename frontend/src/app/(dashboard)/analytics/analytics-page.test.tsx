import { formatPeriodLabel } from './page';

describe('formatPeriodLabel', () => {
  it('converts YYYY-MM period into Indonesian month names', () => {
    expect(formatPeriodLabel('2026-01')).toBe('Jan');
    expect(formatPeriodLabel('2026-09')).toBe('Sep');
    expect(formatPeriodLabel('2026-12')).toBe('Des');
  });
});
