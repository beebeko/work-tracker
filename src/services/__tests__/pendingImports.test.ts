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
  getDocs: jest.fn(),
  updateDoc: jest.fn(),
  query: jest.fn((...args: unknown[]) => args[0]),
  orderBy: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
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

import { addDoc, collection, doc, getDocs, query, updateDoc } from 'firebase/firestore';
import { auth } from '../../lib/firebase';
import { createPendingImport, listPendingImports, updatePendingImport } from '../pendingImports';

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp;

const baseExtracted = {
  date: '2026-06-01',
  entryType: 'shift' as const,
  startTime: '08:00',
  endTime: '18:00',
  confidence: 0.92,
};

function makeImportDoc(overrides = {}) {
  return {
    id: 'import-1',
    data: () => ({
      ownerUid: 'test-uid',
      clientId: 'client-1',
      rawEmail: 'You are booked for June 1st.',
      extracted: baseExtracted,
      status: 'pending',
      createdAt: mockTimestamp,
      ...overrides,
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (collection as jest.Mock).mockReturnValue('pending-imports-coll');
  (doc as jest.Mock).mockReturnValue('import-doc-ref');
  (query as jest.Mock).mockImplementation((...args: unknown[]) => args[0]);
});

describe('listPendingImports', () => {
  describe('happy path', () => {
    it('returns all imports for the authenticated user, newest first', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [makeImportDoc(), makeImportDoc({ id: 'import-2', status: 'dismissed' })],
      });

      const result = await listPendingImports();

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('pending');
    });
  });

  describe('error handling', () => {
    it('throws when not authenticated', async () => {
      (auth as { currentUser: null | { uid: string } }).currentUser = null;
      await expect(listPendingImports()).rejects.toThrow('Not authenticated');
      (auth as { currentUser: null | { uid: string } }).currentUser = { uid: 'test-uid' };
    });

    it('propagates Firestore errors', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce(new Error('Firestore down'));
      await expect(listPendingImports()).rejects.toThrow('Firestore down');
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no imports exist', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
      const result = await listPendingImports();
      expect(result).toEqual([]);
    });
  });
});

describe('createPendingImport', () => {
  describe('happy path', () => {
    it('creates an import and returns the new document id', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'import-new' });

      const id = await createPendingImport({
        ownerUid: 'test-uid',
        clientId: 'client-1',
        rawEmail: 'Call sheet attached.',
        extracted: baseExtracted,
        status: 'pending',
      });

      expect(id).toBe('import-new');
      expect(addDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('throws when not authenticated', async () => {
      (auth as { currentUser: null | { uid: string } }).currentUser = null;
      await expect(
        createPendingImport({
          ownerUid: 'test-uid',
          clientId: 'client-1',
          rawEmail: '',
          extracted: baseExtracted,
          status: 'pending',
        }),
      ).rejects.toThrow('Not authenticated');
      (auth as { currentUser: null | { uid: string } }).currentUser = { uid: 'test-uid' };
    });

    it('propagates addDoc failure', async () => {
      (addDoc as jest.Mock).mockRejectedValueOnce(new Error('quota exceeded'));
      await expect(
        createPendingImport({
          ownerUid: 'test-uid',
          clientId: 'client-1',
          rawEmail: '',
          extracted: baseExtracted,
          status: 'pending',
        }),
      ).rejects.toThrow('quota exceeded');
    });
  });
});

describe('updatePendingImport', () => {
  describe('happy path', () => {
    it('updates the status to dismissed', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await updatePendingImport('import-1', { status: 'dismissed' });
      expect(updateDoc).toHaveBeenCalledWith('import-doc-ref', { status: 'dismissed' });
    });

    it('updates the status to imported', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await updatePendingImport('import-1', { status: 'imported' });
      expect(updateDoc).toHaveBeenCalledWith('import-doc-ref', { status: 'imported' });
    });
  });

  describe('error handling', () => {
    it('throws when not authenticated', async () => {
      (auth as { currentUser: null | { uid: string } }).currentUser = null;
      await expect(updatePendingImport('import-1', { status: 'dismissed' })).rejects.toThrow(
        'Not authenticated',
      );
      (auth as { currentUser: null | { uid: string } }).currentUser = { uid: 'test-uid' };
    });

    it('propagates Firestore errors', async () => {
      (updateDoc as jest.Mock).mockRejectedValueOnce(new Error('update failed'));
      await expect(updatePendingImport('import-1', { status: 'dismissed' })).rejects.toThrow(
        'update failed',
      );
    });
  });
});
