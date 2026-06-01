jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn((...args: unknown[]) => args[0]),
  orderBy: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _isServerTimestamp: true })),
  Timestamp: { now: jest.fn(), fromDate: jest.fn() },
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-uid' } })),
  GoogleAuthProvider: jest.fn(() => ({})),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  googleProvider: {},
}));

import { addDoc, deleteDoc, doc, getDoc, getDocs, orderBy, updateDoc, where } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { lumpSumEntryFixture, shiftEntryFixture } from '../../__fixtures__/entities.fixtures';
import {
  createEntry,
  deleteEntry,
  getEntry,
  listEntries,
  listEntriesByPosition,
  updateEntry,
} from '../entries';

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp;

function makeShiftDoc(overrides = {}) {
  return {
    id: shiftEntryFixture.id,
    exists: () => true,
    data: () => ({
      ownerUid: 'test-uid',
      positionId: 'position-1',
      type: 'shift',
      date: '2026-05-01',
      startTime: '08:00',
      endTime: '17:00',
      mealBreaks: [],
      tags: [],
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      ...overrides,
    }),
  };
}

function makeLumpSumDoc(overrides = {}) {
  return {
    id: lumpSumEntryFixture.id,
    exists: () => true,
    data: () => ({
      ownerUid: 'test-uid',
      positionId: 'position-1',
      type: 'lump_sum',
      date: '2026-05-02',
      amount: 500,
      tags: [],
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      ...overrides,
    }),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('listEntries', () => {
  describe('happy path', () => {
    it('returns shift entries for the given gig', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [makeShiftDoc()] });
      const result = await listEntries('client-1', 'gig-1');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('shift');
      expect(orderBy).toHaveBeenCalledWith('date');
    });

    it('returns lump_sum entries correctly', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [makeLumpSumDoc()] });
      const result = await listEntries('client-1', 'gig-1');
      expect(result[0].type).toBe('lump_sum');
    });

    it('returns empty array when no entries', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
      expect(await listEntries('client-1', 'gig-1')).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws when Firestore rejects', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));
      await expect(listEntries('client-1', 'gig-1')).rejects.toThrow('Firestore error');
    });
  });
});

describe('listEntriesByPosition', () => {
  describe('happy path', () => {
    it('filters by positionId', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [makeShiftDoc()] });
      await listEntriesByPosition('client-1', 'gig-1', 'position-1');
      expect(where).toHaveBeenCalledWith('positionId', '==', 'position-1');
    });
  });
});

describe('getEntry', () => {
  describe('happy path', () => {
    it('returns the shift entry by id', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce(makeShiftDoc());
      const result = await getEntry('client-1', 'gig-1', 'entry-1');
      expect(result.type).toBe('shift');
    });
  });

  describe('error handling', () => {
    it('throws when entry not found', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
      await expect(getEntry('client-1', 'gig-1', 'missing')).rejects.toThrow(
        'Entry missing not found',
      );
    });
  });
});

describe('createEntry', () => {
  describe('happy path', () => {
    it('creates a shift entry and returns it', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'new-entry' });
      (getDoc as jest.Mock).mockResolvedValueOnce({ ...makeShiftDoc(), id: 'new-entry' });
      await createEntry('client-1', 'gig-1', {
        type: 'shift',
        gigId: 'gig-1',
        clientId: 'client-1',
        positionId: 'position-1',
        date: '2026-05-01',
        startTime: '08:00',
        endTime: '17:00',
        mealBreaks: [],
        tags: [],
      });
      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ type: 'shift', gigId: 'gig-1' }),
      );
    });

    it('creates a lump_sum entry and returns it', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'new-lump' });
      (getDoc as jest.Mock).mockResolvedValueOnce({ ...makeLumpSumDoc(), id: 'new-lump' });
      await createEntry('client-1', 'gig-1', {
        type: 'lump_sum',
        gigId: 'gig-1',
        clientId: 'client-1',
        positionId: 'position-1',
        date: '2026-05-02',
        amount: 500,
        tags: [],
      });
      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ type: 'lump_sum', amount: 500 }),
      );
    });
  });
});

describe('updateEntry', () => {
  describe('happy path', () => {
    it('calls updateDoc with the patch', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await updateEntry('client-1', 'gig-1', 'entry-1', { date: '2026-05-03' } as never);
      expect(updateDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ date: '2026-05-03' }),
      );
    });
  });
});

describe('deleteEntry', () => {
  describe('happy path', () => {
    it('calls deleteDoc with the correct ref', async () => {
      (deleteDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await deleteEntry('client-1', 'gig-1', 'entry-1');
      expect(doc).toHaveBeenCalledWith(
        {},
        'clients',
        'client-1',
        'gigs',
        'gig-1',
        'entries',
        'entry-1',
      );
    });
  });
});
