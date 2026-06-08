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
  serverTimestamp: jest.fn(() => ({})),
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
  functions: {},
  storage: {},
}));

jest.mock('../../services/pendingImports');

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { pendingImportFixture } from '../../__fixtures__/entities.fixtures';
import { listPendingImports, updatePendingImport } from '../../services/pendingImports';
import { createWrapper } from '../../test-utils/queryWrapper';
import {
    usePendingImportCount,
    usePendingImports,
    useUpdatePendingImport,
} from '../usePendingImports';

beforeEach(() => jest.clearAllMocks());

describe('usePendingImports', () => {
  describe('happy path', () => {
    it('fetches and returns all imports', async () => {
      (listPendingImports as jest.Mock).mockResolvedValue([pendingImportFixture]);

      const { result } = renderHook(() => usePendingImports(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].status).toBe('pending');
    });
  });

  describe('error handling', () => {
    it('surfaces Firestore errors via isError', async () => {
      (listPendingImports as jest.Mock).mockRejectedValue(new Error('Firestore down'));

      const { result } = renderHook(() => usePendingImports(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no imports exist', async () => {
      (listPendingImports as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => usePendingImports(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual([]);
    });
  });
});

describe('usePendingImportCount', () => {
  describe('happy path', () => {
    it('returns the count of pending-status imports only', async () => {
      (listPendingImports as jest.Mock).mockResolvedValue([
        pendingImportFixture,
        { ...pendingImportFixture, id: 'import-2', status: 'dismissed' },
        { ...pendingImportFixture, id: 'import-3', status: 'imported' },
      ]);

      const { result } = renderHook(() => usePendingImportCount(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current).toBe(1));
    });
  });

  describe('edge cases', () => {
    it('returns 0 before data loads', () => {
      (listPendingImports as jest.Mock).mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => usePendingImportCount(), { wrapper: createWrapper() });
      expect(result.current).toBe(0);
    });

    it('returns 0 when all imports are dismissed or imported', async () => {
      (listPendingImports as jest.Mock).mockResolvedValue([
        { ...pendingImportFixture, status: 'dismissed' },
        { ...pendingImportFixture, id: 'import-2', status: 'imported' },
      ]);

      const { result } = renderHook(() => usePendingImportCount(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current).toBe(0));
    });
  });
});

describe('useUpdatePendingImport', () => {
  describe('happy path', () => {
    it('calls updatePendingImport with the new status', async () => {
      (updatePendingImport as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdatePendingImport('import-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('dismissed');
      });

      expect(updatePendingImport).toHaveBeenCalledWith('import-1', { status: 'dismissed' });
    });

    it('calls updatePendingImport with status imported', async () => {
      (updatePendingImport as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdatePendingImport('import-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('imported');
      });

      expect(updatePendingImport).toHaveBeenCalledWith('import-1', { status: 'imported' });
    });
  });

  describe('error handling', () => {
    it('propagates error from updatePendingImport', async () => {
      (updatePendingImport as jest.Mock).mockRejectedValue(new Error('update failed'));

      const { result } = renderHook(() => useUpdatePendingImport('import-1'), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('dismissed');
        }),
      ).rejects.toThrow('update failed');
    });
  });
});
