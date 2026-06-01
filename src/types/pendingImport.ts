import { Timestamp } from 'firebase/firestore';
import { WorkEntryType } from './workEntry';

export type PendingImportStatus = 'pending' | 'dismissed' | 'imported';

/**
 * The structured payload extracted from an email by OpenAI.
 * All fields except date, entryType, and confidence are optional
 * because the email may not contain them.
 */
export interface ExtractedJobData {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  entryType: WorkEntryType;
  /** ISO time string (HH:mm) — present for shift entries */
  startTime?: string;
  /** ISO time string (HH:mm) — present for shift entries */
  endTime?: string;
  /** Total amount in USD — present for lump_sum entries */
  amount?: number;
  /** Raw position name from email, not yet resolved to a positionId */
  positionHint?: string;
  /** Raw gig/project name from email, not yet resolved to a gigId */
  gigHint?: string;
  notes?: string;
  /** 0–1 float; reflects how confident OpenAI is in the extraction */
  confidence: number;
}

export interface PendingImport {
  id: string;
  ownerUid: string;
  clientId: string;
  /**
   * Truncated raw email body (max 10 KB).
   * Stored for debugging; readable by the owner via Firestore but not surfaced in the app UI.
   */
  rawEmail: string;
  extracted: ExtractedJobData;
  status: PendingImportStatus;
  createdAt: Timestamp;
}

export type CreatePendingImportInput = Omit<PendingImport, 'id' | 'createdAt'>;

export type UpdatePendingImportInput = Pick<PendingImport, 'status'>;
