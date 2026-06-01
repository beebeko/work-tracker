import { Timestamp } from 'firebase/firestore';

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
  deleteDoc: jest.fn(),
  query: jest.fn((...args: unknown[]) => args[0]),
  orderBy: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _isServerTimestamp: true })),
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

import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query } from 'firebase/firestore';
import { auth } from '../../lib/firebase';
import { createClientSender, deleteClientSender, listClientSenders } from '../clientSenders';

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp;
const CLIENT_ID = 'client-1';

function makeSenderDoc(overrides = {}) {
  return {
    id: 'sender-1',
    data: () => ({
      ownerUid: 'test-uid',
      clientId: CLIENT_ID,
      pattern: 'scheduler@company.com',
      patternType: 'address',
      createdAt: mockTimestamp,
      ...overrides,
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (collection as jest.Mock).mockReturnValue('senders-coll');
  (doc as jest.Mock).mockReturnValue('sender-doc-ref');
  (query as jest.Mock).mockImplementation((...args: unknown[]) => args[0]);
});

describe('listClientSenders', () => {
  describe('happy path', () => {
    it('returns senders for the client ordered by pattern', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [makeSenderDoc()] });

      const result = await listClientSenders(CLIENT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].pattern).toBe('scheduler@company.com');
      expect(result[0].patternType).toBe('address');
    });
  });

  describe('error handling', () => {
    it('throws when not authenticated', async () => {
      (auth as { currentUser: null | { uid: string } }).currentUser = null;
      await expect(listClientSenders(CLIENT_ID)).rejects.toThrow('Not authenticated');
      (auth as { currentUser: null | { uid: string } }).currentUser = { uid: 'test-uid' };
    });

    it('propagates Firestore errors', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce(new Error('Firestore unavailable'));
      await expect(listClientSenders(CLIENT_ID)).rejects.toThrow('Firestore unavailable');
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no senders exist', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
      const result = await listClientSenders(CLIENT_ID);
      expect(result).toEqual([]);
    });
  });
});

describe('createClientSender', () => {
  describe('happy path', () => {
    it('creates an address-type sender and returns the new record', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'sender-new' });
      (getDoc as jest.Mock).mockResolvedValueOnce({
        id: 'sender-new',
        data: () => ({
          ownerUid: 'test-uid',
          clientId: CLIENT_ID,
          pattern: 'scheduler@company.com',
          patternType: 'address',
          createdAt: mockTimestamp,
        }),
      });

      const result = await createClientSender({
        clientId: CLIENT_ID,
        pattern: 'scheduler@company.com',
        patternType: 'address',
      });

      expect(result.id).toBe('sender-new');
      expect(result.patternType).toBe('address');
      expect(addDoc).toHaveBeenCalledTimes(1);
    });

    it('creates a domain-type sender', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'sender-dom' });
      (getDoc as jest.Mock).mockResolvedValueOnce({
        id: 'sender-dom',
        data: () => ({
          ownerUid: 'test-uid',
          clientId: CLIENT_ID,
          pattern: 'company.com',
          patternType: 'domain',
          createdAt: mockTimestamp,
        }),
      });

      const result = await createClientSender({
        clientId: CLIENT_ID,
        pattern: 'company.com',
        patternType: 'domain',
      });

      expect(result.patternType).toBe('domain');
    });
  });

  describe('error handling', () => {
    it('throws when not authenticated', async () => {
      (auth as { currentUser: null | { uid: string } }).currentUser = null;
      await expect(
        createClientSender({ clientId: CLIENT_ID, pattern: 'x@y.com', patternType: 'address' }),
      ).rejects.toThrow('Not authenticated');
      (auth as { currentUser: null | { uid: string } }).currentUser = { uid: 'test-uid' };
    });

    it('propagates addDoc failure', async () => {
      (addDoc as jest.Mock).mockRejectedValueOnce(new Error('write failed'));
      await expect(
        createClientSender({ clientId: CLIENT_ID, pattern: 'x@y.com', patternType: 'address' }),
      ).rejects.toThrow('write failed');
    });

    it('propagates getDoc failure after addDoc succeeds', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'sender-new' });
      (getDoc as jest.Mock).mockRejectedValueOnce(new Error('read failed'));
      await expect(
        createClientSender({ clientId: CLIENT_ID, pattern: 'x@y.com', patternType: 'address' }),
      ).rejects.toThrow('read failed');
    });
  });
});

describe('deleteClientSender', () => {
  describe('happy path', () => {
    it('calls deleteDoc with the correct reference', async () => {
      (deleteDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await deleteClientSender(CLIENT_ID, 'sender-1');
      expect(deleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('throws when not authenticated', async () => {
      (auth as { currentUser: null | { uid: string } }).currentUser = null;
      await expect(deleteClientSender(CLIENT_ID, 'sender-1')).rejects.toThrow('Not authenticated');
      (auth as { currentUser: null | { uid: string } }).currentUser = { uid: 'test-uid' };
    });

    it('propagates Firestore errors', async () => {
      (deleteDoc as jest.Mock).mockRejectedValueOnce(new Error('delete failed'));
      await expect(deleteClientSender(CLIENT_ID, 'sender-1')).rejects.toThrow('delete failed');
    });
  });
});
