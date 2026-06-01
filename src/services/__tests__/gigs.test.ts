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
import { gigFixture } from '../../__fixtures__/entities.fixtures';
import { createGig, deleteGig, getGig, listActiveGigs, listGigs, updateGig } from '../gigs';

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp;

function makeGigDoc(overrides = {}) {
  return {
    id: gigFixture.id,
    exists: () => true,
    data: () => ({
      ownerUid: 'test-uid',
      name: 'Feature Film Spring 2026',
      status: 'active',
      tags: ['feature'],
      startDate: '2026-04-01',
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      ...overrides,
    }),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('listGigs', () => {
  describe('happy path', () => {
    it('returns gigs for the given clientId', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [makeGigDoc()] });
      const result = await listGigs('client-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Feature Film Spring 2026');
      expect(orderBy).toHaveBeenCalledWith('name');
    });

    it('returns empty array when no gigs', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
      expect(await listGigs('client-1')).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws when Firestore rejects', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));
      await expect(listGigs('client-1')).rejects.toThrow('Firestore error');
    });
  });
});

describe('listActiveGigs', () => {
  describe('happy path', () => {
    it('filters by status=active', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [makeGigDoc()] });
      await listActiveGigs('client-1');
      expect(where).toHaveBeenCalledWith('status', '==', 'active');
    });
  });
});

describe('getGig', () => {
  describe('happy path', () => {
    it('returns the gig by id', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce(makeGigDoc());
      const result = await getGig('client-1', 'gig-1');
      expect(result.status).toBe('active');
    });
  });

  describe('error handling', () => {
    it('throws when gig not found', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
      await expect(getGig('client-1', 'missing')).rejects.toThrow('Gig missing not found');
    });
  });
});

describe('createGig', () => {
  describe('happy path', () => {
    it('creates a gig and returns the full document', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'new-gig' });
      (getDoc as jest.Mock).mockResolvedValueOnce({ ...makeGigDoc(), id: 'new-gig' });
      await createGig('client-1', {
        clientId: 'client-1',
        name: 'New Gig',
        status: 'active',
        tags: [],
      });
      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ name: 'New Gig', clientId: 'client-1' }),
      );
    });
  });
});

describe('updateGig', () => {
  describe('happy path', () => {
    it('calls updateDoc with the patch', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await updateGig('client-1', 'gig-1', { status: 'complete' });
      expect(updateDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ status: 'complete' }),
      );
    });
  });
});

describe('deleteGig', () => {
  describe('happy path', () => {
    it('calls deleteDoc with the correct ref', async () => {
      (deleteDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await deleteGig('client-1', 'gig-1');
      expect(doc).toHaveBeenCalledWith({}, 'clients', 'client-1', 'gigs', 'gig-1');
    });
  });
});
