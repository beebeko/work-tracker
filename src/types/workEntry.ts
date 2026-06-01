import { Timestamp } from 'firebase/firestore';

export type WorkEntryType = 'shift' | 'lump_sum';

/** A single meal break within a shift */
export interface MealBreak {
  /** ISO time string (HH:mm) */
  startTime: string;
  /** ISO time string (HH:mm) */
  endTime: string;
}

interface BaseWorkEntry {
  id: string;
  gigId: string;
  clientId: string;
  positionId: string;
  ownerUid: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  tags: string[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ShiftEntry extends BaseWorkEntry {
  type: 'shift';
  /** ISO time string (HH:mm) */
  startTime: string;
  /** ISO time string (HH:mm) */
  endTime: string;
  mealBreaks: MealBreak[];
}

export interface LumpSumEntry extends BaseWorkEntry {
  type: 'lump_sum';
  /** Total amount in USD */
  amount: number;
  /** Optional description for the lump sum */
  description?: string;
}

export type WorkEntry = ShiftEntry | LumpSumEntry;

export type CreateShiftEntryInput = Omit<ShiftEntry, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;
export type CreateLumpSumEntryInput = Omit<
  LumpSumEntry,
  'id' | 'ownerUid' | 'createdAt' | 'updatedAt'
>;
export type CreateWorkEntryInput = CreateShiftEntryInput | CreateLumpSumEntryInput;
export type UpdateWorkEntryInput = Partial<CreateWorkEntryInput>;
