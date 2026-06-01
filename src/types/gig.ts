import { Timestamp } from 'firebase/firestore';

export type GigStatus = 'active' | 'complete' | 'cancelled' | 'on_hold';

export interface Gig {
  id: string;
  clientId: string;
  ownerUid: string;
  name: string;
  status: GigStatus;
  /** ISO date string (YYYY-MM-DD) */
  startDate?: string;
  /** ISO date string (YYYY-MM-DD) */
  endDate?: string;
  tags: string[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateGigInput = Omit<Gig, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>;
export type UpdateGigInput = Partial<CreateGigInput>;
