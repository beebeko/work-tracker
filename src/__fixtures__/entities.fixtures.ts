import { Timestamp } from 'firebase/firestore';
import { Client, DEFAULT_OVERTIME_RULES } from '../types/client';
import { Gig } from '../types/gig';
import { Invoice } from '../types/invoice';
import { Position } from '../types/position';
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
  subtotal: 967.5,
  totalAmount: 967.5,
  dueDate: '2026-06-01',
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
};
