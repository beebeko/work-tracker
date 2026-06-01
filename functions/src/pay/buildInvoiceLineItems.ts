import { MealBreak, OvertimeRules, calcMealPenalty, calcShiftMinutes, splitShiftHoursForOT } from './calculatePay';

// Minimal local types used only within Cloud Functions context
export interface Position {
  id: string;
  name: string;
  baseRate: number;
}

export interface ShiftEntry {
  id: string;
  type: 'shift';
  date: string;
  positionId: string;
  startTime: string;
  endTime: string;
  mealBreaks: MealBreak[];
}

export interface LumpSumEntry {
  id: string;
  type: 'lump_sum';
  date: string;
  amount: number;
  description?: string;
}

export type WorkEntry = ShiftEntry | LumpSumEntry;

export interface InvoiceLineItem {
  description: string;
  hours?: number;
  rate?: number;
  amount: number;
}

export function getWeekStartDate(dateStr: string, weekStartDay: number): string {
  const date = new Date(`${dateStr}T12:00:00`);
  const day = date.getDay();
  const diff = (day - weekStartDay + 7) % 7;
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string): string {
  const [, month, day] = weekStart.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `wk of ${months[month - 1]} ${day}`;
}

export function buildInvoiceLineItems(
  entries: WorkEntry[],
  positionsById: Record<string, Position>,
  rules: OvertimeRules,
): InvoiceLineItem[] {
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

    const shifts = weekEntries
      .filter((e): e is ShiftEntry => e.type === 'shift')
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
      });

    const lumpSums = weekEntries.filter((e): e is LumpSumEntry => e.type === 'lump_sum');

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

    for (const [positionId, pb] of breakdown) {
      const position = positionsById[positionId];
      const posName = position?.name ?? positionId;

      if (pb.regularHours > 0) {
        lineItems.push({
          description: `${posName} — Regular (${weekLabel})`,
          hours: Math.round(pb.regularHours * 100) / 100,
          rate: position?.baseRate,
          amount: Math.round(pb.regularPay * 100) / 100,
        });
      }

      if (pb.overtimeHours > 0) {
        lineItems.push({
          description: `${posName} — Overtime (${weekLabel})`,
          hours: Math.round(pb.overtimeHours * 100) / 100,
          rate: position
            ? Math.round(position.baseRate * rules.weeklyOvertimeMultiplier * 100) / 100
            : undefined,
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

    for (const entry of lumpSums) {
      lineItems.push({
        description: entry.description ? `Lump sum: ${entry.description}` : 'Lump sum',
        amount: entry.amount,
      });
    }
  }

  return lineItems;
}
