import { Timestamp } from 'firebase/firestore';

// Days of the week: 0=Sunday, 1=Monday, ... 6=Saturday
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Overtime and meal penalty rules for a client.
 * Can be overridden per position.
 */
export interface OvertimeRules {
  weekStartDay: DayOfWeek;
  weeklyThresholdHours: number;
  weeklyOvertimeMultiplier: number;
  /** Optional daily OT threshold (e.g. 8 hrs/day) */
  dailyThresholdHours?: number;
  /** Required if dailyThresholdHours is set */
  dailyOvertimeMultiplier?: number;
  mealPenaltyEnabled: boolean;
  /** Hours elapsed without a break before a meal penalty is triggered */
  mealPenaltyWindowHours: number;
  /** Penalty expressed as equivalent hours at base rate */
  mealPenaltyRateHours: number;
}

export const DEFAULT_OVERTIME_RULES: OvertimeRules = {
  weekStartDay: 1, // Monday
  weeklyThresholdHours: 40,
  weeklyOvertimeMultiplier: 1.5,
  mealPenaltyEnabled: false,
  mealPenaltyWindowHours: 7,
  mealPenaltyRateHours: 1,
};

export interface Client {
  id: string;
  ownerUid: string;
  name: string;
  email: string;
  address?: string;
  notes?: string;
  overtimeRules: OvertimeRules;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateClientInput = Omit<Client, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;
export type UpdateClientInput = Partial<CreateClientInput>;
