import { Timestamp } from 'firebase/firestore';
import { Client, DEFAULT_OVERTIME_RULES } from '../types/client';
import { ClientSender } from '../types/clientSender';
import { EmailAccount } from '../types/emailAccount';
import { Gig } from '../types/gig';
import { Invoice } from '../types/invoice';
import { PendingImport } from '../types/pendingImport';
import { Position } from '../types/position';
import { UserProfile } from '../types/userProfile';
import { LumpSumEntry, ShiftEntry } from '../types/workEntry';

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp;

export const clientFixture: Client = {
  id: 'client-1',
  ownerUid: 'test-uid',
  name: 'Acme Productions',
  email: 'acme@example.com',
  address: '123 Film St, Los Angeles, CA',
  notes: 'Prefers invoices by the 1st',
  overtimeRules: {
    ...DEFAULT_OVERTIME_RULES,
    mealPenaltyEnabled: true,
  },
  invoicePrefix: 'AP',
  nextInvoiceSeq: 1,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

export const positionFixture: Position = {
  id: 'position-1',
  clientId: 'client-1',
  ownerUid: 'test-uid',
  name: 'Key Grip',
  baseRate: 55,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

export const gigFixture: Gig = {
  id: 'gig-1',
  clientId: 'client-1',
  ownerUid: 'test-uid',
  name: 'Feature Film Spring 2026',
  status: 'active',
  startDate: '2026-04-01',
  endDate: '2026-06-30',
  tags: ['feature', 'union'],
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

export const shiftEntryFixture: ShiftEntry = {
  id: 'entry-1',
  gigId: 'gig-1',
  clientId: 'client-1',
  positionId: 'position-1',
  ownerUid: 'test-uid',
  type: 'shift',
  date: '2026-05-01',
  startTime: '08:00',
  endTime: '17:00',
  mealBreaks: [{ startTime: '13:00', endTime: '13:30' }],
  tags: [],
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

export const lumpSumEntryFixture: LumpSumEntry = {
  id: 'entry-2',
  gigId: 'gig-1',
  clientId: 'client-1',
  positionId: 'position-1',
  ownerUid: 'test-uid',
  type: 'lump_sum',
  date: '2026-05-02',
  amount: 500,
  description: 'Box rental',
  tags: ['kit-rental'],
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

export const invoiceFixture: Invoice = {
  id: 'invoice-1',
  clientId: 'client-1',
  gigId: 'gig-1',
  ownerUid: 'test-uid',
  invoiceNumber: 'INV-001',
  status: 'draft',
  lineItems: [
    { description: 'Key Grip — 8.5 hours @ $55', hours: 8.5, rate: 55, amount: 467.5 },
    { description: 'Box Rental', amount: 500 },
  ],
  entryIds: ['entry-1', 'entry-2'],
  subtotal: 967.5,
  totalAmount: 967.5,
  dueDate: '2026-06-01',
  history: [],
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

export const userProfileFixture: UserProfile = {
  uid: 'test-uid',
  name: 'Alice Smith',
  email: 'alice@example.com',
  address: '123 Main St, Los Angeles, CA',
  phone: '555-1234',
  updatedAt: mockTimestamp,
};

export const emailAccountFixture: EmailAccount = {
  id: 'acc-1',
  ownerUid: 'test-uid',
  displayName: 'Work',
  fromAddress: 'work@example.com',
  isDefault: true,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};

export const clientSenderFixture: ClientSender = {
  id: 'sender-1',
  ownerUid: 'test-uid',
  clientId: 'client-1',
  pattern: 'scheduler@acme.com',
  patternType: 'address',
  createdAt: mockTimestamp,
};

export const pendingImportFixture: PendingImport = {
  id: 'import-1',
  ownerUid: 'test-uid',
  clientId: 'client-1',
  rawEmail: 'You are booked for June 1st, 8am–6pm as Key Grip on Feature Film.',
  extracted: {
    date: '2026-06-01',
    entryType: 'shift',
    startTime: '08:00',
    endTime: '18:00',
    positionHint: 'Key Grip',
    gigHint: 'Feature Film',
    confidence: 0.92,
  },
  status: 'pending',
  createdAt: mockTimestamp,
};
