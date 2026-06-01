import { Timestamp } from 'firebase/firestore';

// Mock firebase modules before importing anything that uses them
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

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { auth } from '../../lib/firebase';
import { clientFixture } from '../../__fixtures__/entities.fixtures';
import { createClient, deleteClient, getClient, listClients, updateClient } from '../clients';

// Mock the firebase lib module so auth.currentUser returns our test-uid
// auth is a mutable object so individual tests can set currentUser = null
jest.mock('../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  googleProvider: {},
}));

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp;

function makeClientDoc(overrides = {}) {
  return {
    id: clientFixture.id,
    exists: () => true,
    data: () => ({
      ownerUid: 'test-uid',
      name: 'Acme Productions',
      email: 'acme@example.com',
      overtimeRules: clientFixture.overtimeRules,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      ...overrides,
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listClients', () => {
  describe('happy path', () => {
    it('returns clients owned by the current user', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [makeClientDoc()],
      });

      const result = await listClients();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Acme Productions');
      expect(query).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith('name');
    });

    it('returns empty array when no clients exist', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
      const result = await listClients();
      expect(result).toEqual([]);
    });
  });

  describe('filtering', () => {
    it('filters out docs not owned by the current user', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [makeClientDoc({ ownerUid: 'other-uid' })],
      });
      const result = await listClients();
      expect(result).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('throws when Firestore rejects', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));
      await expect(listClients()).rejects.toThrow('Firestore error');
    });
  });
});

describe('getClient', () => {
  describe('happy path', () => {
    it('returns the client by id', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce(makeClientDoc());
      const result = await getClient('client-1');
      expect(result.id).toBe('client-1');
      expect(result.email).toBe('acme@example.com');
      expect(doc).toHaveBeenCalledWith({}, 'clients', 'client-1');
    });
  });

  describe('error handling', () => {
    it('throws when client not found', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
      await expect(getClient('missing')).rejects.toThrow('Client missing not found');
    });

    it('throws when Firestore rejects', async () => {
      (getDoc as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      await expect(getClient('client-1')).rejects.toThrow('Network error');
    });
  });
});

describe('createClient', () => {
  describe('happy path', () => {
    it('creates a client and returns the full document', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'new-id' });
      (getDoc as jest.Mock).mockResolvedValueOnce({
        ...makeClientDoc(),
        id: 'new-id',
      });

      const input = {
        name: 'New Client',
        email: 'new@example.com',
        overtimeRules: clientFixture.overtimeRules,
      };
      const result = await createClient(input);
      expect(addDoc).toHaveBeenCalledWith(
        undefined, // collection() mock returns undefined
        expect.objectContaining({ ownerUid: 'test-uid', name: 'New Client' }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('throws when not authenticated', async () => {
      (auth as { currentUser: { uid: string } | null }).currentUser = null;
      await expect(
        createClient({
          name: 'X',
          email: 'x@x.com',
          overtimeRules: clientFixture.overtimeRules,
        }),
      ).rejects.toThrow('Not authenticated');
      (auth as { currentUser: { uid: string } | null }).currentUser = { uid: 'test-uid' };
    });
  });
});

describe('updateClient', () => {
  describe('happy path', () => {
    it('calls updateDoc with patch and updatedAt', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await updateClient('client-1', { name: 'Renamed' });
      expect(updateDoc).toHaveBeenCalledWith(
        undefined, // doc() mock
        expect.objectContaining({ name: 'Renamed' }),
      );
    });
  });

  describe('error handling', () => {
    it('throws when Firestore rejects', async () => {
      (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
      await expect(updateClient('client-1', { name: 'X' })).rejects.toThrow('Permission denied');
    });
  });
});

describe('deleteClient', () => {
  describe('happy path', () => {
    it('calls deleteDoc with the correct ref', async () => {
      (deleteDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await deleteClient('client-1');
      expect(deleteDoc).toHaveBeenCalled();
      expect(doc).toHaveBeenCalledWith({}, 'clients', 'client-1');
    });
  });

  describe('error handling', () => {
    it('throws when Firestore rejects', async () => {
      (deleteDoc as jest.Mock).mockRejectedValueOnce(new Error('Not found'));
      await expect(deleteClient('bad-id')).rejects.toThrow('Not found');
    });
  });
});

// Verify collection path is used correctly
describe('collection path', () => {
  it('uses the clients collection for all operations', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
    await listClients();
    expect(collection).toHaveBeenCalledWith({}, 'clients');
  });
});
