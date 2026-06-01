import { DayOfWeek, OvertimeRules } from '../types/client';
import { InvoiceLineItem } from '../types/invoice';
import { Position } from '../types/position';
import { LumpSumEntry, ShiftEntry, WorkEntry } from '../types/workEntry';
import { calcMealPenalty, calcShiftMinutes, splitShiftHoursForOT } from './calculatePay';

/**
 * Returns the ISO date string (YYYY-MM-DD) for the start of the week that
 * contains `dateStr`, using `weekStartDay` as the first day of the week.
 */
export function getWeekStartDate(dateStr: string, weekStartDay: DayOfWeek): string {
  // Parse as local noon to avoid DST edge cases shifting the date
  const date = new Date(`${dateStr}T12:00:00`);
  const day = date.getDay(); // 0=Sunday
  const diff = (day - weekStartDay + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
}

/**
 * Formats a week start date for display in line item descriptions.
 * e.g. "2026-05-25" → "wk of May 25"
 */
function formatWeekLabel(weekStart: string): string {
  const [, month, day] = weekStart.split('-').map(Number);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `wk of ${months[month - 1]} ${day}`;
}

/**
 * Converts a set of work entries into invoice line items using the same
 * weekly OT calculation logic as calculateWeeklyPay.
 *
 * Algorithm:
 *   1. Group entries by ISO week (using rules.weekStartDay).
 *   2. Within each week, process shifts in chronological order, accumulating
 *      running hours to determine regular vs. overtime split per shift.
 *   3. Aggregate per-position regular pay, OT pay, and meal penalties.
 *   4. Lump-sum entries become individual line items.
 *
 * @param entries       Work entries to invoice (caller selects which to include).
 * @param positionsById Map of positionId → Position (for name + baseRate).
 * @param rules         OT/meal-penalty rules for the client.
 */
export function buildInvoiceLineItems(
  entries: WorkEntry[],
  positionsById: Record<string, Position>,
  rules: OvertimeRules,
): InvoiceLineItem[] {
  // Group entries by week start date
  const weekMap = new Map<string, WorkEntry[]>();
  for (const entry of entries) {
    const weekKey = getWeekStartDate(entry.date, rules.weekStartDay);
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
    weekMap.get(weekKey)!.push(entry);
  }

  const lineItems: InvoiceLineItem[] = [];
  const sortedWeeks = [...weekMap.keys()].sort();

  for (const weekKey of sortedWeeks) {
    const weekEntries = weekMap.get(weekKey)!;
    const weekLabel = formatWeekLabel(weekKey);

    // Separate and sort shifts
    const shifts = weekEntries
      .filter((e): e is ShiftEntry => e.type === 'shift')
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
      });

    const lumpSums = weekEntries.filter((e): e is LumpSumEntry => e.type === 'lump_sum');

    // Per-position breakdown for this week
    const breakdown = new Map<
      string,
      {
        regularHours: number;
        regularPay: number;
        overtimeHours: number;
        overtimePay: number;
        mealPenalties: number;
      }
    >();

    let runningHours = 0;

    for (const shift of shifts) {
      const position = positionsById[shift.positionId];
      if (!position) continue;

      const shiftMinutes = calcShiftMinutes(shift.startTime, shift.endTime, shift.mealBreaks);
      const shiftHours = shiftMinutes / 60;

      const { regularHours, overtimeHours } = splitShiftHoursForOT(shiftHours, runningHours, rules);
      runningHours += shiftHours;

      const mealPenalty = calcMealPenalty(
        shift.startTime,
        shift.endTime,
        shift.mealBreaks,
        position.baseRate,
        rules,
      );

      if (!breakdown.has(shift.positionId)) {
        breakdown.set(shift.positionId, {
          regularHours: 0,
          regularPay: 0,
          overtimeHours: 0,
          overtimePay: 0,
          mealPenalties: 0,
        });
      }

      const pb = breakdown.get(shift.positionId)!;
      pb.regularHours += regularHours;
      pb.regularPay += regularHours * position.baseRate;
      pb.overtimeHours += overtimeHours;
      pb.overtimePay += overtimeHours * position.baseRate * rules.weeklyOvertimeMultiplier;
      pb.mealPenalties += mealPenalty;
    }

    // Convert breakdown to line items
    for (const [positionId, pb] of breakdown) {
      const position = positionsById[positionId] as Position; // always defined (guarded above)
      const posName = position.name;

      if (pb.regularHours > 0) {
        lineItems.push({
          description: `${posName} — Regular (${weekLabel})`,
          hours: Math.round(pb.regularHours * 100) / 100,
          rate: position.baseRate,
          amount: Math.round(pb.regularPay * 100) / 100,
        });
      }

      if (pb.overtimeHours > 0) {
        lineItems.push({
          description: `${posName} — Overtime (${weekLabel})`,
          hours: Math.round(pb.overtimeHours * 100) / 100,
          rate: Math.round(position.baseRate * rules.weeklyOvertimeMultiplier * 100) / 100,
          amount: Math.round(pb.overtimePay * 100) / 100,
        });
      }

      if (pb.mealPenalties > 0) {
        lineItems.push({
          description: `Meal penalty — ${posName} (${weekLabel})`,
          amount: Math.round(pb.mealPenalties * 100) / 100,
        });
      }
    }

    // Lump sums as individual line items
    for (const entry of lumpSums) {
      lineItems.push({
        description: entry.description ? `Lump sum: ${entry.description}` : 'Lump sum',
        amount: entry.amount,
      });
    }
  }

  return lineItems;
}
