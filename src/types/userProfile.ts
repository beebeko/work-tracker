import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  address?: string;
  phone?: string;
  updatedAt: Timestamp;
}

export type UpdateUserProfileInput = Omit<UserProfile, 'uid' | 'updatedAt'>;
