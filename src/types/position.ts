import { Timestamp } from 'firebase/firestore';

import { OvertimeRules } from './client';

export interface Position {
  id: string;
  clientId: string;
  ownerUid: string;
  name: string;
  /** Hourly base rate in USD */
  baseRate: number;
  /** Optional overrides for this position; inherits client OvertimeRules for unset fields */
  overtimeRulesOverride?: Partial<OvertimeRules>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreatePositionInput = Omit<Position, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;
export type UpdatePositionInput = Partial<CreatePositionInput>;
