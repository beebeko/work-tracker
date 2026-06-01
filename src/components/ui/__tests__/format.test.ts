import { formatDate, formatHours, formatMoney } from '../format';

describe('formatHours', () => {
  describe('happy path', () => {
    it('formats whole hours', () => {
      expect(formatHours(8)).toBe('8h');
    });

    it('formats hours and minutes', () => {
      expect(formatHours(8.5)).toBe('8h 30m');
    });

    it('formats minutes only when less than 1 hour', () => {
      expect(formatHours(0.75)).toBe('45m');
    });

    it('formats 0 minutes', () => {
      expect(formatHours(0)).toBe('0m');
    });

    it('rounds minutes correctly', () => {
      expect(formatHours(1.0166)).toBe('1h 1m');
    });
  });

  describe('edge cases', () => {
    it('handles exactly 1 hour', () => {
      expect(formatHours(1)).toBe('1h');
    });

    it('handles fractional hours resulting in 0 extra minutes', () => {
      expect(formatHours(2.0)).toBe('2h');
    });
  });
});

describe('formatMoney', () => {
  describe('happy path', () => {
    it('formats whole dollar amounts', () => {
      expect(formatMoney(100)).toBe('$100.00');
    });

    it('formats amounts with cents', () => {
      expect(formatMoney(1234.56)).toBe('$1,234.56');
    });

    it('formats zero', () => {
      expect(formatMoney(0)).toBe('$0.00');
    });

    it('formats large amounts with comma separators', () => {
      expect(formatMoney(10000)).toBe('$10,000.00');
    });
  });

  describe('edge cases', () => {
    it('rounds to 2 decimal places', () => {
      expect(formatMoney(1.005)).toMatch(/^\$1\.0[01]$/);
    });
  });
});

describe('formatDate', () => {
  describe('happy path', () => {
    it('formats a date string as MMM D, YYYY', () => {
      expect(formatDate('2026-05-15')).toBe('May 15, 2026');
    });

    it('formats January 1', () => {
      expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
    });

    it('formats December 31', () => {
      expect(formatDate('2026-12-31')).toBe('Dec 31, 2026');
    });
  });

  describe('edge cases', () => {
    it('does not shift date due to timezone', () => {
      // Parsing YYYY-MM-DD as local midnight avoids timezone-induced day shifts
      const result = formatDate('2026-03-01');
      expect(result).toBe('Mar 1, 2026');
    });
  });
});
