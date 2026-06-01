import { buildInvoiceLineItems, getWeekStartDate } from '../../pay/buildInvoiceLineItems';
import type { OvertimeRules } from '../../types/client';
import { DEFAULT_OVERTIME_RULES } from '../../types/client';
import type { Position } from '../../types/position';
import type { WorkEntry } from '../../types/workEntry';

const rules: OvertimeRules = {
  ...DEFAULT_OVERTIME_RULES,
  weeklyThresholdHours: 40,
  weeklyOvertimeMultiplier: 1.5,
  weekStartDay: 1, // Monday
  mealPenaltyEnabled: false,
  mealPenaltyWindowHours: 6,
  mealPenaltyRateHours: 0.5,
};

const keyGrip: Position = {
  id: 'pos-1',
  ownerUid: 'uid',
  gigId: 'gig-1',
  name: 'Key Grip',
  baseRate: 50,
  createdAt: null as any,
  updatedAt: null as any,
};

const bestBoy: Position = {
  id: 'pos-2',
  ownerUid: 'uid',
  gigId: 'gig-1',
  name: 'Best Boy',
  baseRate: 45,
  createdAt: null as any,
  updatedAt: null as any,
};

const positionsById: Record<string, Position> = { 'pos-1': keyGrip, 'pos-2': bestBoy };

const mockTimestamp = { toMillis: () => 0 } as any;

function makeShift(id: string, date: string, start: string, end: string): WorkEntry {
  return {
    id,
    type: 'shift',
    ownerUid: 'uid',
    gigId: 'gig-1',
    positionId: 'pos-1',
    date,
    startTime: start,
    endTime: end,
    mealBreaks: [],
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };
}

describe('getWeekStartDate', () => {
  it('returns Monday for a Wednesday date with weekStartDay=1', () => {
    expect(getWeekStartDate('2026-05-27', 1)).toBe('2026-05-25');
  });

  it('returns Sunday for a Wednesday date with weekStartDay=0', () => {
    expect(getWeekStartDate('2026-05-27', 0)).toBe('2026-05-24');
  });

  it('returns the same day if it is the week start', () => {
    expect(getWeekStartDate('2026-05-25', 1)).toBe('2026-05-25'); // Monday
  });
});

describe('buildInvoiceLineItems', () => {
  it('returns empty array for empty entries', () => {
    expect(buildInvoiceLineItems([], positionsById, rules)).toEqual([]);
  });

  it('creates a regular-hours line item for a single 8-hour shift', () => {
    const entries: WorkEntry[] = [makeShift('e1', '2026-05-25', '08:00', '16:00')];
    const items = buildInvoiceLineItems(entries, positionsById, rules);
    expect(items).toHaveLength(1);
    expect(items[0].description).toContain('Regular');
    expect(items[0].hours).toBe(8);
    expect(items[0].rate).toBe(50);
    expect(items[0].amount).toBe(400);
  });

  it('splits into regular and overtime line items when over weekly threshold', () => {
    // 5 days × 9 hours = 45h total; 40 regular, 5 OT
    const entries: WorkEntry[] = Array.from({ length: 5 }, (_, i) =>
      makeShift(`e${i}`, `2026-05-2${i + 5}`, '08:00', '17:00'),
    );
    // Limit to Mon-Fri of the same week
    const weekEntries = [
      makeShift('e0', '2026-05-25', '08:00', '17:00'), // Mon
      makeShift('e1', '2026-05-26', '08:00', '17:00'),
      makeShift('e2', '2026-05-27', '08:00', '17:00'),
      makeShift('e3', '2026-05-28', '08:00', '17:00'),
      makeShift('e4', '2026-05-29', '08:00', '17:00'), // Fri
    ];
    const items = buildInvoiceLineItems(weekEntries, positionsById, rules);
    const regular = items.find((i) => i.description.includes('Regular'));
    const overtime = items.find((i) => i.description.includes('Overtime'));
    expect(regular).toBeDefined();
    expect(overtime).toBeDefined();
    expect(regular!.hours).toBe(40);
    expect(overtime!.hours).toBe(5);
    expect(overtime!.amount).toBeCloseTo(5 * 50 * 1.5);
  });

  it('adds meal penalty line item when enabled and threshold exceeded', () => {
    const mealRules: OvertimeRules = {
      ...rules,
      mealPenaltyEnabled: true,
      mealPenaltyWindowHours: 6,
      mealPenaltyRateHours: 0.5,
    };
    // 9-hour shift with no meal break → 9h longest stretch > 6h threshold
    const entries: WorkEntry[] = [makeShift('e1', '2026-05-25', '08:00', '17:00')];
    const items = buildInvoiceLineItems(entries, positionsById, mealRules);
    const penalty = items.find((i) => i.description.includes('Meal penalty'));
    expect(penalty).toBeDefined();
    expect(penalty!.amount).toBe(0.5 * 50); // 0.5 rate hours × $50
  });

  it('creates lump sum line items', () => {
    const lumpEntry: WorkEntry = {
      id: 'e-ls',
      type: 'lump_sum',
      ownerUid: 'uid',
      gigId: 'gig-1',
      date: '2026-05-25',
      amount: 200,
      description: 'Box rental',
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    };
    const items = buildInvoiceLineItems([lumpEntry], positionsById, rules);
    expect(items).toHaveLength(1);
    expect(items[0].description).toContain('Box rental');
    expect(items[0].amount).toBe(200);
  });

  it('handles two weeks separately', () => {
    const week1 = makeShift('e1', '2026-05-25', '08:00', '16:00'); // Mon wk1
    const week2 = makeShift('e2', '2026-06-01', '08:00', '16:00'); // Mon wk2
    const items = buildInvoiceLineItems([week1, week2], positionsById, rules);
    // Each week produces its own regular line item
    expect(items).toHaveLength(2);
    expect(items[0].description).toContain('May 25');
    expect(items[1].description).toContain('Jun 1');
  });

  it('generates only overtime line item when a position has zero regular hours', () => {
    // pos-1 (Key Grip) works 40 hours → all regular, no OT
    // pos-2 (Best Boy) works 8 hours after 40h threshold is met → all OT, 0 regular
    const pos1Shifts = [
      makeShift('e0', '2026-05-25', '08:00', '16:00'), // 8h
      makeShift('e1', '2026-05-26', '08:00', '16:00'),
      makeShift('e2', '2026-05-27', '08:00', '16:00'),
      makeShift('e3', '2026-05-28', '08:00', '16:00'),
      makeShift('e4', '2026-05-29', '08:00', '16:00'), // 40h total for pos-1
    ];
    const pos2Shift: WorkEntry = {
      id: 'e5',
      type: 'shift',
      ownerUid: 'uid',
      gigId: 'gig-1',
      positionId: 'pos-2',
      date: '2026-05-30',
      startTime: '10:00',
      endTime: '18:00', // 8h all OT
      mealBreaks: [],
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    };
    const items = buildInvoiceLineItems([...pos1Shifts, pos2Shift], positionsById, rules);
    const pos1Regular = items.find(
      (i) => i.description.includes('Key Grip') && i.description.includes('Regular'),
    );
    const pos1OT = items.find(
      (i) => i.description.includes('Key Grip') && i.description.includes('Overtime'),
    );
    const pos2Regular = items.find(
      (i) => i.description.includes('Best Boy') && i.description.includes('Regular'),
    );
    const pos2OT = items.find(
      (i) => i.description.includes('Best Boy') && i.description.includes('Overtime'),
    );

    expect(pos1Regular).toBeDefined();
    expect(pos1OT).toBeUndefined(); // pos-1 didn't work OT
    expect(pos2Regular).toBeUndefined(); // pos-2 has zero regular hours → no regular line item
    expect(pos2OT).toBeDefined();
    expect(pos2OT!.hours).toBe(8);
  });

  it('sorts shifts on the same date by startTime (tie-breaker branch)', () => {
    // Two shifts on the same date — the sort should use startTime as tie-breaker
    const morning = makeShift('e1', '2026-05-25', '07:00', '12:00'); // 5h
    const afternoon = makeShift('e2', '2026-05-25', '13:00', '17:00'); // 4h
    const items = buildInvoiceLineItems([afternoon, morning], positionsById, rules); // reversed order
    expect(items).toHaveLength(1); // both regular, same position → merged into one line item
    expect(items[0].hours).toBe(9);
  });

  it('creates a lump sum line item with default description when none provided', () => {
    const lumpEntry: WorkEntry = {
      id: 'e-ls',
      type: 'lump_sum',
      ownerUid: 'uid',
      gigId: 'gig-1',
      date: '2026-05-25',
      amount: 150,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    };
    const items = buildInvoiceLineItems([lumpEntry], positionsById, rules);
    expect(items[0].description).toBe('Lump sum');
  });

  it('skips entries whose positionId is not in positionsById', () => {
    const orphan = makeShift('e1', '2026-05-25', '08:00', '16:00');
    (orphan as any).positionId = 'unknown-pos';
    const items = buildInvoiceLineItems([orphan], positionsById, rules);
    expect(items).toHaveLength(0);
  });
});
