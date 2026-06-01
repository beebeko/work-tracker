/**
 * Tests for functions/src/pay/calculatePay.ts
 * This is a copy of the app-side pay engine; the same coverage rules apply (≥95%).
 */
import {
    calcShiftMinutes,
    calculateWeeklyPay,
    OvertimeRules,
    parseTimeToMinutes,
} from '../pay/calculatePay';

const defaultRules: OvertimeRules = {
  weeklyThresholdHours: 40,
  weeklyOvertimeMultiplier: 1.5,
  weekStartDay: 1, // Monday
  mealPenaltyEnabled: false,
  mealPenaltyWindowHours: 6,
  mealPenaltyRateHours: 0.5,
};

// ─── parseTimeToMinutes ───────────────────────────────────────────────────────

describe('parseTimeToMinutes', () => {
  it('converts HH:MM to total minutes', () => {
    expect(parseTimeToMinutes('08:00')).toBe(480);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
    expect(parseTimeToMinutes('12:30')).toBe(750);
  });
});

// ─── calcShiftMinutes ─────────────────────────────────────────────────────────

describe('calcShiftMinutes', () => {
  it('calculates shift duration with no breaks', () => {
    expect(calcShiftMinutes('08:00', '16:00', [])).toBe(480);
  });

  it('subtracts meal break duration', () => {
    const breaks = [{ startTime: '12:00', endTime: '12:30' }];
    expect(calcShiftMinutes('08:00', '16:00', breaks)).toBe(450);
  });

  it('handles overnight shifts', () => {
    // 22:00 → 06:00 = 8h
    expect(calcShiftMinutes('22:00', '06:00', [])).toBe(480);
  });

  it('handles overnight meal break', () => {
    // 22:00 → 06:00 with a 30-min break at 00:00
    const breaks = [{ startTime: '00:00', endTime: '00:30' }];
    expect(calcShiftMinutes('22:00', '06:00', breaks)).toBe(450);
  });

  it('subtracts multiple breaks', () => {
    const breaks = [
      { startTime: '10:00', endTime: '10:15' },
      { startTime: '13:00', endTime: '13:30' },
    ];
    expect(calcShiftMinutes('08:00', '17:00', breaks)).toBe(495);
  });
});

// ─── calculateWeeklyPay ───────────────────────────────────────────────────────

describe('calculateWeeklyPay', () => {
  it('returns zero pay for empty entries', () => {
    const result = calculateWeeklyPay([], defaultRules);
    expect(result.regularPay).toBe(0);
    expect(result.overtimePay).toBe(0);
    expect(result.totalPay).toBe(0);
  });

  it('calculates straight-time pay under threshold', () => {
    // 8h shift, no OT
    const entries = [
      { type: 'shift' as const, date: '2026-05-04', startTime: '09:00', endTime: '17:00', mealBreaks: [], baseRate: 50 },
    ];
    const result = calculateWeeklyPay(entries, defaultRules);
    expect(result.regularHours).toBe(8);
    expect(result.regularPay).toBe(400);
    expect(result.overtimeHours).toBe(0);
    expect(result.totalPay).toBe(400);
  });

  it('calculates weekly overtime beyond threshold', () => {
    // 5 × 9h = 45h → 40h regular + 5h OT
    const entries = ['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'].map(
      (date) => ({
        type: 'shift' as const,
        date,
        startTime: '09:00',
        endTime: '18:00',
        mealBreaks: [],
        baseRate: 40,
      }),
    );
    const result = calculateWeeklyPay(entries, defaultRules);
    expect(result.regularHours).toBe(40);
    expect(result.overtimeHours).toBe(5);
    expect(result.overtimePay).toBeCloseTo(5 * 40 * 1.5);
    expect(result.totalPay).toBeCloseTo(40 * 40 + 5 * 40 * 1.5);
  });

  it('accumulates lump-sum entries', () => {
    const entries = [
      { type: 'lump_sum' as const, amount: 250 },
      { type: 'lump_sum' as const, amount: 100 },
    ];
    const result = calculateWeeklyPay(entries, defaultRules);
    expect(result.lumpSum).toBe(350);
    expect(result.totalPay).toBe(350);
  });

  it('combines shifts and lump sums', () => {
    const entries = [
      { type: 'shift' as const, date: '2026-05-04', startTime: '09:00', endTime: '17:00', mealBreaks: [], baseRate: 50 },
      { type: 'lump_sum' as const, amount: 100 },
    ];
    const result = calculateWeeklyPay(entries, defaultRules);
    expect(result.regularPay).toBe(400);
    expect(result.lumpSum).toBe(100);
    expect(result.totalPay).toBe(500);
  });

  it('applies meal penalties when enabled', () => {
    const rulesWithPenalty: OvertimeRules = {
      ...defaultRules,
      mealPenaltyEnabled: true,
      mealPenaltyWindowHours: 6,
      mealPenaltyRateHours: 0.5,
    };
    // 9h shift, no break → 1 meal penalty (past 6h window, no break taken)
    const entries = [
      { type: 'shift' as const, date: '2026-05-04', startTime: '09:00', endTime: '18:00', mealBreaks: [], baseRate: 50 },
    ];
    const result = calculateWeeklyPay(entries, rulesWithPenalty);
    expect(result.mealPenalties).toBeGreaterThan(0);
  });

  it('does not apply meal penalty when break is taken within window', () => {
    const rulesWithPenalty: OvertimeRules = {
      ...defaultRules,
      mealPenaltyEnabled: true,
      mealPenaltyWindowHours: 6,
      mealPenaltyRateHours: 0.5,
    };
    // 8h shift with a 30-min break at the 5h mark
    const entries = [
      {
        type: 'shift' as const,
        date: '2026-05-04',
        startTime: '09:00',
        endTime: '17:00',
        mealBreaks: [{ startTime: '14:00', endTime: '14:30' }],
        baseRate: 50,
      },
    ];
    const result = calculateWeeklyPay(entries, rulesWithPenalty);
    expect(result.mealPenalties).toBe(0);
  });

  it('does not include entries sorted later from OT accumulation', () => {
    // Two shifts: the second is earlier on the same day — should be sorted before first
    // Total 10h, no OT
    const entries = [
      { type: 'shift' as const, date: '2026-05-04', startTime: '09:00', endTime: '17:00', mealBreaks: [], baseRate: 50 },
      { type: 'shift' as const, date: '2026-05-04', startTime: '07:00', endTime: '09:00', mealBreaks: [], baseRate: 50 },
    ];
    const result = calculateWeeklyPay(entries, defaultRules);
    expect(result.regularHours).toBe(10);
    expect(result.overtimeHours).toBe(0);
  });

  it('uses splitShiftHoursForOT to correctly split a shift straddling the OT threshold', () => {
    // 38h from prior shifts, then one 4h shift → 2h regular + 2h OT
    const priorShifts = Array.from({ length: 19 }, (_, i) => ({
      type: 'shift' as const,
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      startTime: '08:00',
      endTime: '10:00',
      mealBreaks: [],
      baseRate: 60,
    }));
    const pushingShift = {
      type: 'shift' as const,
      date: '2026-05-20',
      startTime: '08:00',
      endTime: '12:00',
      mealBreaks: [],
      baseRate: 60,
    };
    const result = calculateWeeklyPay([...priorShifts, pushingShift], defaultRules);
    expect(result.regularHours).toBe(40);
    expect(result.overtimeHours).toBe(2);
    expect(result.overtimePay).toBeCloseTo(2 * 60 * 1.5);
  });
});
