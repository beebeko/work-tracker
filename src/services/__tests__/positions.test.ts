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

import { addDoc, deleteDoc, doc, getDoc, getDocs, orderBy, Timestamp, updateDoc } from 'firebase/firestore';
import { positionFixture } from '../../__fixtures__/entities.fixtures';
import {
    createPosition,
    deletePosition,
    getPosition,
    listPositions,
    updatePosition,
} from '../positions';

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp;

function makePositionDoc(overrides = {}) {
  return {
    id: positionFixture.id,
    exists: () => true,
    data: () => ({
      ownerUid: 'test-uid',
      name: 'Key Grip',
      baseRate: 55,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      ...overrides,
    }),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('listPositions', () => {
  describe('happy path', () => {
    it('returns positions for the given clientId', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [makePositionDoc()] });
      const result = await listPositions('client-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Key Grip');
      expect(orderBy).toHaveBeenCalledWith('name');
    });

    it('returns empty array when no positions exist', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
      expect(await listPositions('client-1')).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws when Firestore rejects', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));
      await expect(listPositions('client-1')).rejects.toThrow('Firestore error');
    });
  });
});

describe('getPosition', () => {
  describe('happy path', () => {
    it('returns the position by id', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce(makePositionDoc());
      const result = await getPosition('client-1', 'position-1');
      expect(result.baseRate).toBe(55);
    });
  });

  describe('error handling', () => {
    it('throws when position not found', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
      await expect(getPosition('client-1', 'missing')).rejects.toThrow(
        'Position missing not found',
      );
    });
  });
});

describe('createPosition', () => {
  describe('happy path', () => {
    it('creates a position and returns the full document', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'new-pos' });
      (getDoc as jest.Mock).mockResolvedValueOnce({ ...makePositionDoc(), id: 'new-pos' });
      const result = await createPosition('client-1', {
        clientId: 'client-1',
        name: 'Best Boy',
        baseRate: 45,
      });
      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ name: 'Best Boy', clientId: 'client-1' }),
      );
      expect(result).toBeDefined();
    });
  });
});

describe('updatePosition', () => {
  describe('happy path', () => {
    it('calls updateDoc with the patch', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await updatePosition('client-1', 'position-1', { baseRate: 60 });
      expect(updateDoc).toHaveBeenCalledWith(undefined, expect.objectContaining({ baseRate: 60 }));
    });
  });
});

describe('deletePosition', () => {
  describe('happy path', () => {
    it('calls deleteDoc with the correct ref', async () => {
      (deleteDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await deletePosition('client-1', 'position-1');
      expect(deleteDoc).toHaveBeenCalled();
      expect(doc).toHaveBeenCalledWith({}, 'clients', 'client-1', 'positions', 'position-1');
    });
  });
});
