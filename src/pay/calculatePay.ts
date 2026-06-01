import { OvertimeRules } from '../types/client';
import { MealBreak } from '../types/workEntry';

export interface PayBreakdown {
  regularHours: number;
  regularPay: number;
  overtimeHours: number;
  overtimePay: number;
  mealPenalties: number;
  lumpSum: number;
  totalPay: number;
}

export interface ShiftInput {
  type: 'shift';
  date: string;
  startTime: string;
  endTime: string;
  mealBreaks: MealBreak[];
  baseRate: number;
}

export interface LumpSumInput {
  type: 'lump_sum';
  amount: number;
}

export type EntryInput = ShiftInput | LumpSumInput;

/**
 * Parses an "HH:mm" time string into total minutes from midnight.
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculates the total elapsed minutes for a shift, excluding meal breaks.
 */
export function calcShiftMinutes(
  startTime: string,
  endTime: string,
  mealBreaks: MealBreak[],
): number {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const shiftMinutes =
    endMinutes >= startMinutes ? endMinutes - startMinutes : endMinutes + 24 * 60 - startMinutes; // crosses midnight

  const breakMinutes = mealBreaks.reduce((total, b) => {
    const bStart = parseTimeToMinutes(b.startTime);
    const bEnd = parseTimeToMinutes(b.endTime);
    return total + (bEnd >= bStart ? bEnd - bStart : bEnd + 24 * 60 - bStart);
  }, 0);

  return Math.max(0, shiftMinutes - breakMinutes);
}

/**
 * Returns the length of the longest unbroken work stretch (in hours) within a shift.
 * Used to determine if a meal penalty applies.
 */
export function calcLongestStretchHours(
  startTime: string,
  endTime: string,
  mealBreaks: MealBreak[],
): number {
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);
  const shiftEndMins = endMins >= startMins ? endMins : endMins + 24 * 60;

  if (mealBreaks.length === 0) {
    return (shiftEndMins - startMins) / 60;
  }

  const sortedBreaks = [...mealBreaks].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
  );

  let maxStretch = 0;
  let cursor = startMins;

  for (const b of sortedBreaks) {
    const bStart = parseTimeToMinutes(b.startTime);
    const stretch = bStart - cursor;
    if (stretch > maxStretch) maxStretch = stretch;
    const bEnd = parseTimeToMinutes(b.endTime);
    cursor = bEnd >= parseTimeToMinutes(b.startTime) ? bEnd : bEnd + 24 * 60;
  }

  // Stretch from last break end to shift end
  const finalStretch = shiftEndMins - cursor;
  if (finalStretch > maxStretch) maxStretch = finalStretch;

  return maxStretch / 60;
}

/**
 * Calculates the meal penalty for a single shift (in USD).
 * Returns 0 if no penalty applies.
 */
export function calcMealPenalty(
  startTime: string,
  endTime: string,
  mealBreaks: MealBreak[],
  baseRate: number,
  rules: OvertimeRules,
): number {
  if (!rules.mealPenaltyEnabled) return 0;
  const longestStretch = calcLongestStretchHours(startTime, endTime, mealBreaks);
  if (longestStretch > rules.mealPenaltyWindowHours) {
    return rules.mealPenaltyRateHours * baseRate;
  }
  return 0;
}

/**
 * A single week's worth of shift hours, split into regular and overtime,
 * given an accumulated running total before this shift and the rules.
 */
export function splitShiftHoursForOT(
  shiftHours: number,
  runningTotalHours: number,
  rules: OvertimeRules,
): { regularHours: number; overtimeHours: number } {
  const remaining = Math.max(0, rules.weeklyThresholdHours - runningTotalHours);
  const regularHours = Math.min(shiftHours, remaining);
  const overtimeHours = Math.max(0, shiftHours - regularHours);
  return { regularHours, overtimeHours };
}

/**
 * Calculates total pay breakdown for a week of entries.
 *
 * Key rule: OT is accumulated across ALL shift entries in the week,
 * regardless of position. Entries are processed in chronological order.
 * Lump-sum entries are pass-through and do not affect the hourly OT pool.
 */
export function calculateWeeklyPay(entries: EntryInput[], rules: OvertimeRules): PayBreakdown {
  // Separate and sort shifts chronologically; collect lump sums
  const shifts = entries
    .filter((e): e is ShiftInput => e.type === 'shift')
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

  const lumpSums = entries.filter((e): e is LumpSumInput => e.type === 'lump_sum');

  let runningHours = 0;
  let regularHours = 0;
  let regularPay = 0;
  let overtimeHours = 0;
  let overtimePay = 0;
  let mealPenalties = 0;

  for (const shift of shifts) {
    const shiftMinutes = calcShiftMinutes(shift.startTime, shift.endTime, shift.mealBreaks);
    const shiftHours = shiftMinutes / 60;

    const { regularHours: reg, overtimeHours: ot } = splitShiftHoursForOT(
      shiftHours,
      runningHours,
      rules,
    );

    regularHours += reg;
    regularPay += reg * shift.baseRate;
    overtimeHours += ot;
    overtimePay += ot * shift.baseRate * rules.weeklyOvertimeMultiplier;
    runningHours += shiftHours;

    mealPenalties += calcMealPenalty(
      shift.startTime,
      shift.endTime,
      shift.mealBreaks,
      shift.baseRate,
      rules,
    );
  }

  const lumpSum = lumpSums.reduce((sum, e) => sum + e.amount, 0);
  const totalPay = regularPay + overtimePay + mealPenalties + lumpSum;

  return {
    regularHours,
    regularPay,
    overtimeHours,
    overtimePay,
    mealPenalties,
    lumpSum,
    totalPay,
  };
}
