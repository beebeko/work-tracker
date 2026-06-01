import { Timestamp } from 'firebase/firestore';

export interface EmailAccount {
  id: string;
  ownerUid: string;
  /** User-facing label, e.g. "Work" or "Personal" */
  displayName: string;
  /** The address used in the From field, e.g. "work@me.com" */
  fromAddress: string;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateEmailAccountInput = Omit<
  EmailAccount,
  'id' | 'ownerUid' | 'createdAt' | 'updatedAt'
>;
export type UpdateEmailAccountInput = Partial<CreateEmailAccountInput>;
