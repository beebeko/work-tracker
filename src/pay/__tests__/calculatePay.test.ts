import { DEFAULT_OVERTIME_RULES, OvertimeRules } from '../../types/client';
import {
    calcLongestStretchHours,
    calcMealPenalty,
    calcShiftMinutes,
    calculateWeeklyPay,
    parseTimeToMinutes,
    splitShiftHoursForOT,
} from '../calculatePay';

const BASE_RULES: OvertimeRules = {
  ...DEFAULT_OVERTIME_RULES,
  weeklyThresholdHours: 40,
  weeklyOvertimeMultiplier: 1.5,
  mealPenaltyEnabled: false,
  mealPenaltyWindowHours: 7,
  mealPenaltyRateHours: 1,
};

const MEAL_PENALTY_RULES: OvertimeRules = {
  ...BASE_RULES,
  mealPenaltyEnabled: true,
  mealPenaltyWindowHours: 7,
  mealPenaltyRateHours: 1,
};

// ---------------------------------------------------------------------------
// parseTimeToMinutes
// ---------------------------------------------------------------------------
describe('parseTimeToMinutes', () => {
  describe('happy path', () => {
    it('converts 09:00 to 540', () => expect(parseTimeToMinutes('09:00')).toBe(540));
    it('converts 00:00 to 0', () => expect(parseTimeToMinutes('00:00')).toBe(0));
    it('converts 23:59 to 1439', () => expect(parseTimeToMinutes('23:59')).toBe(1439));
    it('converts 12:30 to 750', () => expect(parseTimeToMinutes('12:30')).toBe(750));
  });
});

// ---------------------------------------------------------------------------
// calcShiftMinutes
// ---------------------------------------------------------------------------
describe('calcShiftMinutes', () => {
  describe('happy path', () => {
    it('calculates 8-hour shift with no breaks', () => {
      expect(calcShiftMinutes('09:00', '17:00', [])).toBe(480);
    });

    it('subtracts a single meal break', () => {
      expect(calcShiftMinutes('09:00', '17:00', [{ startTime: '13:00', endTime: '13:30' }])).toBe(
        450,
      );
    });

    it('subtracts multiple breaks', () => {
      const breaks = [
        { startTime: '11:00', endTime: '11:15' },
        { startTime: '14:00', endTime: '14:30' },
      ];
      expect(calcShiftMinutes('09:00', '17:00', breaks)).toBe(480 - 15 - 30);
    });
  });

  describe('edge cases', () => {
    it('handles midnight-crossing shift', () => {
      // 22:00 to 02:00 = 4 hours = 240 mins
      expect(calcShiftMinutes('22:00', '02:00', [])).toBe(240);
    });

    it('returns 0 if shift duration equals total break time', () => {
      expect(calcShiftMinutes('09:00', '09:30', [{ startTime: '09:00', endTime: '09:30' }])).toBe(
        0,
      );
    });
  });

  describe('bad input', () => {
    it('returns 0 if breaks exceed shift duration', () => {
      // Protect against degenerate input
      expect(calcShiftMinutes('09:00', '09:15', [{ startTime: '09:00', endTime: '10:00' }])).toBe(
        0,
      );
    });

    it('handles a midnight-crossing break within a shift', () => {
      // Shift: 21:00-03:00 (6h), break: 23:30-00:30 (1h midnight-crossing)
      // bEnd(30) < bStart(1410) → midnight-crossing break branch
      expect(calcShiftMinutes('21:00', '03:00', [{ startTime: '23:30', endTime: '00:30' }])).toBe(
        300,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// calcLongestStretchHours
// ---------------------------------------------------------------------------
describe('calcLongestStretchHours', () => {
  describe('happy path', () => {
    it('returns full shift duration when no breaks', () => {
      expect(calcLongestStretchHours('09:00', '17:00', [])).toBeCloseTo(8);
    });

    it('returns longest stretch when one break divides shift unevenly', () => {
      // 09:00–14:00 = 5h, 14:30–17:00 = 2.5h → longest = 5h
      const result = calcLongestStretchHours('09:00', '17:00', [
        { startTime: '14:00', endTime: '14:30' },
      ]);
      expect(result).toBeCloseTo(5);
    });

    it('uses last stretch when it is the longest', () => {
      // 09:00–10:00 = 1h, 10:30–17:00 = 6.5h → longest = 6.5h
      const result = calcLongestStretchHours('09:00', '17:00', [
        { startTime: '10:00', endTime: '10:30' },
      ]);
      expect(result).toBeCloseTo(6.5);
    });
  });

  describe('edge cases', () => {
    it('handles multiple breaks and returns the correct max stretch', () => {
      // 09:00–11:00=2h, break, 11:30–14:00=2.5h, break, 14:30–17:00=2.5h
      const result = calcLongestStretchHours('09:00', '17:00', [
        { startTime: '11:00', endTime: '11:30' },
        { startTime: '14:00', endTime: '14:30' },
      ]);
      expect(result).toBeCloseTo(2.5);
    });

    it('does not update maxStretch when a later segment is shorter', () => {
      // Breaks at 13:00-13:30 and 14:00-14:30
      // Segment 1: 09:00–13:00 = 4h → maxStretch = 4h
      // Segment 2: 13:30–14:00 = 0.5h → 0.5 < 4 → false branch (no update)
      // Final: 14:30–17:00 = 2.5h → 2.5 < 4 → no update
      const result = calcLongestStretchHours('09:00', '17:00', [
        { startTime: '13:00', endTime: '13:30' },
        { startTime: '14:00', endTime: '14:30' },
      ]);
      expect(result).toBeCloseTo(4);
    });

    it('handles a midnight-crossing break correctly', () => {
      // Shift: 22:00–03:00 (5h), break: 23:30–00:30 (1h)
      // Stretch before break: 23:30–22:00 = 1.5h
      // Stretch after break: 03:00–00:30 = 2.5h → longest = 2.5h
      const result = calcLongestStretchHours('22:00', '03:00', [
        { startTime: '23:30', endTime: '00:30' },
      ]);
      expect(result).toBeCloseTo(2.5);
    });
  });
});

// ---------------------------------------------------------------------------
// calcMealPenalty
// ---------------------------------------------------------------------------
describe('calcMealPenalty', () => {
  describe('happy path', () => {
    it('returns penalty when longest stretch exceeds window', () => {
      // 8-hour shift, no breaks, window = 7h → penalty = 1hr * $50 = $50
      expect(calcMealPenalty('09:00', '17:00', [], 50, MEAL_PENALTY_RULES)).toBe(50);
    });

    it('returns 0 when a break keeps stretch under window', () => {
      const breaks = [{ startTime: '13:00', endTime: '13:30' }];
      // 4h stretch before break < 7h window → no penalty
      expect(calcMealPenalty('09:00', '17:00', breaks, 50, MEAL_PENALTY_RULES)).toBe(0);
    });

    it('returns 0 when meal penalty is disabled', () => {
      expect(calcMealPenalty('09:00', '17:00', [], 50, BASE_RULES)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('returns 0 when stretch equals window exactly (not exceeded)', () => {
      // 7-hour shift exactly equals window → no penalty (must be strictly greater)
      expect(calcMealPenalty('09:00', '16:00', [], 50, MEAL_PENALTY_RULES)).toBe(0);
    });

    it('uses custom penalty rate hours', () => {
      const rules: OvertimeRules = { ...MEAL_PENALTY_RULES, mealPenaltyRateHours: 0.5 };
      expect(calcMealPenalty('09:00', '17:00', [], 50, rules)).toBe(25); // 0.5 * $50
    });
  });
});

// ---------------------------------------------------------------------------
// splitShiftHoursForOT
// ---------------------------------------------------------------------------
describe('splitShiftHoursForOT', () => {
  describe('happy path', () => {
    it('all regular when under threshold', () => {
      const result = splitShiftHoursForOT(8, 0, BASE_RULES);
      expect(result).toEqual({ regularHours: 8, overtimeHours: 0 });
    });

    it('all overtime when already over threshold', () => {
      const result = splitShiftHoursForOT(8, 40, BASE_RULES);
      expect(result).toEqual({ regularHours: 0, overtimeHours: 8 });
    });

    it('splits at exact threshold boundary', () => {
      // 36 hours accumulated, 8-hour shift → 4 regular, 4 OT
      const result = splitShiftHoursForOT(8, 36, BASE_RULES);
      expect(result).toEqual({ regularHours: 4, overtimeHours: 4 });
    });
  });

  describe('edge cases', () => {
    it('exactly at threshold → next shift is all OT', () => {
      const result = splitShiftHoursForOT(1, 40, BASE_RULES);
      expect(result).toEqual({ regularHours: 0, overtimeHours: 1 });
    });

    it('one hour under threshold → almost all regular', () => {
      const result = splitShiftHoursForOT(8, 39, BASE_RULES);
      expect(result).toEqual({ regularHours: 1, overtimeHours: 7 });
    });
  });
});

// ---------------------------------------------------------------------------
// calculateWeeklyPay (integration of all logic)
// ---------------------------------------------------------------------------
describe('calculateWeeklyPay', () => {
  describe('happy path', () => {
    it('single shift, no OT, no meal penalty', () => {
      const entries = [
        {
          type: 'shift' as const,
          date: '2026-06-01',
          startTime: '09:00',
          endTime: '17:00',
          mealBreaks: [],
          baseRate: 50,
        },
      ];
      const result = calculateWeeklyPay(entries, BASE_RULES);
      expect(result.regularHours).toBeCloseTo(8);
      expect(result.overtimeHours).toBe(0);
      expect(result.regularPay).toBeCloseTo(400);
      expect(result.overtimePay).toBe(0);
      expect(result.mealPenalties).toBe(0);
      expect(result.lumpSum).toBe(0);
      expect(result.totalPay).toBeCloseTo(400);
    });

    it('lump sum entry passes through without affecting OT pool', () => {
      const entries = [{ type: 'lump_sum' as const, amount: 500 }];
      const result = calculateWeeklyPay(entries, BASE_RULES);
      expect(result.lumpSum).toBe(500);
      expect(result.regularHours).toBe(0);
      expect(result.overtimeHours).toBe(0);
      expect(result.totalPay).toBe(500);
    });

    it('5-day week triggers weekly OT', () => {
      // Mon–Fri, 9 hours/day = 45 hrs → 40 regular + 5 OT
      const days = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
      const entries = days.map((date) => ({
        type: 'shift' as const,
        date,
        startTime: '08:00',
        endTime: '17:00',
        mealBreaks: [],
        baseRate: 40,
      }));
      const result = calculateWeeklyPay(entries, BASE_RULES);
      expect(result.regularHours).toBeCloseTo(40);
      expect(result.overtimeHours).toBeCloseTo(5);
      expect(result.regularPay).toBeCloseTo(1600);
      expect(result.overtimePay).toBeCloseTo(5 * 40 * 1.5); // 300
      expect(result.totalPay).toBeCloseTo(1900);
    });
  });

  describe('multi-position OT pooling', () => {
    it('pools hours across two positions — OT applies to total, not per position', () => {
      // Mon–Wed as A1 (3 × 8h = 24h), Thu–Fri as A2 (2 × 8h = 16h) = 40h total, no OT
      const a1Days = ['2026-06-01', '2026-06-02', '2026-06-03'];
      const a2Days = ['2026-06-04', '2026-06-05'];
      const entries = [
        ...a1Days.map((date) => ({
          type: 'shift' as const,
          date,
          startTime: '09:00',
          endTime: '17:00',
          mealBreaks: [],
          baseRate: 50,
        })),
        ...a2Days.map((date) => ({
          type: 'shift' as const,
          date,
          startTime: '09:00',
          endTime: '17:00',
          mealBreaks: [],
          baseRate: 45,
        })),
      ];
      const result = calculateWeeklyPay(entries, BASE_RULES);
      expect(result.regularHours).toBeCloseTo(40);
      expect(result.overtimeHours).toBe(0);
      expect(result.totalPay).toBeCloseTo(24 * 50 + 16 * 45); // 1200 + 720 = 1920
    });

    it('two positions in same week, OT starts mid-second-position', () => {
      // 36h as A1 (first), then 8h as A2 (last) = 4 regular + 4 OT in A2
      const a1Days = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'];
      const entries = [
        // 4 days × 9 hours = 36 hours as A1
        ...a1Days.map((date) => ({
          type: 'shift' as const,
          date,
          startTime: '08:00',
          endTime: '17:00',
          mealBreaks: [],
          baseRate: 50,
        })),
        // 8-hour shift as A2 on day 5: 4 regular + 4 OT
        {
          type: 'shift' as const,
          date: '2026-06-05',
          startTime: '09:00',
          endTime: '17:00',
          mealBreaks: [],
          baseRate: 45,
        },
      ];
      const result = calculateWeeklyPay(entries, BASE_RULES);
      expect(result.regularHours).toBeCloseTo(40);
      expect(result.overtimeHours).toBeCloseTo(4);
      expect(result.overtimePay).toBeCloseTo(4 * 45 * 1.5); // 270
    });
  });

  describe('meal penalties', () => {
    it('adds penalty for long shift without break', () => {
      const entries = [
        {
          type: 'shift' as const,
          date: '2026-06-01',
          startTime: '09:00',
          endTime: '17:30', // 8.5h stretch
          mealBreaks: [],
          baseRate: 50,
        },
      ];
      const result = calculateWeeklyPay(entries, MEAL_PENALTY_RULES);
      expect(result.mealPenalties).toBe(50); // 1hr @ $50
      expect(result.totalPay).toBeCloseTo(8.5 * 50 + 50); // shifts pay + penalty
    });

    it('no penalty when break is taken in time', () => {
      const entries = [
        {
          type: 'shift' as const,
          date: '2026-06-01',
          startTime: '09:00',
          endTime: '17:00',
          mealBreaks: [{ startTime: '13:00', endTime: '13:30' }],
          baseRate: 50,
        },
      ];
      const result = calculateWeeklyPay(entries, MEAL_PENALTY_RULES);
      expect(result.mealPenalties).toBe(0);
    });
  });

  describe('lump sum + shifts coexistence', () => {
    it('lump sum does not contribute to hourly OT pool', () => {
      // 39 hours of shifts + $500 lump sum — should not push into OT
      const entries = [
        {
          type: 'shift' as const,
          date: '2026-06-01',
          startTime: '08:00',
          endTime: '21:00', // 13h
          mealBreaks: [],
          baseRate: 50,
        },
        {
          type: 'shift' as const,
          date: '2026-06-02',
          startTime: '08:00',
          endTime: '21:00', // 13h
          mealBreaks: [],
          baseRate: 50,
        },
        {
          type: 'shift' as const,
          date: '2026-06-03',
          startTime: '08:00',
          endTime: '21:00', // 13h
          mealBreaks: [],
          baseRate: 50,
        },
        { type: 'lump_sum' as const, amount: 500 },
      ];
      const result = calculateWeeklyPay(entries, BASE_RULES);
      // 39 hours, no OT, plus $500 lump sum
      expect(result.regularHours).toBeCloseTo(39);
      expect(result.overtimeHours).toBe(0);
      expect(result.lumpSum).toBe(500);
      expect(result.totalPay).toBeCloseTo(39 * 50 + 500); // 2450
    });
  });

  describe('PayBreakdown arithmetic consistency', () => {
    it('totalPay always equals sum of components', () => {
      const entries = [
        {
          type: 'shift' as const,
          date: '2026-06-01',
          startTime: '07:00',
          endTime: '18:00',
          mealBreaks: [],
          baseRate: 60,
        },
        {
          type: 'shift' as const,
          date: '2026-06-02',
          startTime: '07:00',
          endTime: '18:00',
          mealBreaks: [],
          baseRate: 60,
        },
        {
          type: 'shift' as const,
          date: '2026-06-03',
          startTime: '07:00',
          endTime: '18:00',
          mealBreaks: [],
          baseRate: 60,
        },
        {
          type: 'shift' as const,
          date: '2026-06-04',
          startTime: '07:00',
          endTime: '18:00',
          mealBreaks: [],
          baseRate: 60,
        },
        { type: 'lump_sum' as const, amount: 200 },
      ];
      const result = calculateWeeklyPay(entries, MEAL_PENALTY_RULES);
      const computed =
        result.regularPay + result.overtimePay + result.mealPenalties + result.lumpSum;
      expect(result.totalPay).toBeCloseTo(computed);
    });
  });

  describe('error handling', () => {
    it('returns zero breakdown for empty entries array', () => {
      const result = calculateWeeklyPay([], BASE_RULES);
      expect(result).toEqual({
        regularHours: 0,
        regularPay: 0,
        overtimeHours: 0,
        overtimePay: 0,
        mealPenalties: 0,
        lumpSum: 0,
        totalPay: 0,
      });
    });

    it('sorts same-day entries by startTime for correct OT accumulation', () => {
      // Two shifts on the same day — later shift should push into OT
      // Shift A: 08:00-16:00 = 8h, Shift B: 17:00-21:00 = 4h
      // Total: 12h in one day; weekly total: 12h (no OT)
      const entries = [
        // Intentionally provide shift B first to test sort
        {
          type: 'shift' as const,
          date: '2026-06-01',
          startTime: '17:00',
          endTime: '21:00',
          mealBreaks: [],
          baseRate: 50,
        },
        {
          type: 'shift' as const,
          date: '2026-06-01',
          startTime: '08:00',
          endTime: '16:00',
          mealBreaks: [],
          baseRate: 50,
        },
      ];
      const result = calculateWeeklyPay(entries, BASE_RULES);
      expect(result.regularHours).toBeCloseTo(12);
      expect(result.overtimeHours).toBe(0);
      expect(result.totalPay).toBeCloseTo(600);
    });
  });
});
