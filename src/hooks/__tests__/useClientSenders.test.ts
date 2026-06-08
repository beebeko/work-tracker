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

jest.mock('../../services/clientSenders');

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { clientSenderFixture } from '../../__fixtures__/entities.fixtures';
import {
    createClientSender,
    deleteClientSender,
    listClientSenders,
} from '../../services/clientSenders';
import { createWrapper } from '../../test-utils/queryWrapper';
import {
    useClientSenders,
    useCreateClientSender,
    useDeleteClientSender,
} from '../useClientSenders';

beforeEach(() => jest.clearAllMocks());

const CLIENT_ID = 'client-1';

describe('useClientSenders', () => {
  describe('happy path', () => {
    it('fetches and returns senders for the client', async () => {
      (listClientSenders as jest.Mock).mockResolvedValue([clientSenderFixture]);

      const { result } = renderHook(() => useClientSenders(CLIENT_ID), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data![0].pattern).toBe('scheduler@acme.com');
    });
  });

  describe('error handling', () => {
    it('surfaces Firestore errors via isError', async () => {
      (listClientSenders as jest.Mock).mockRejectedValue(new Error('Firestore down'));

      const { result } = renderHook(() => useClientSenders(CLIENT_ID), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('edge cases', () => {
    it('does not fetch when clientId is empty', () => {
      const { result } = renderHook(() => useClientSenders(''), {
        wrapper: createWrapper(),
      });
      expect(result.current.fetchStatus).toBe('idle');
      expect(listClientSenders).not.toHaveBeenCalled();
    });
  });
});

describe('useCreateClientSender', () => {
  describe('happy path', () => {
    it('calls createClientSender with the input data', async () => {
      (createClientSender as jest.Mock).mockResolvedValue(clientSenderFixture);

      const { result } = renderHook(() => useCreateClientSender(CLIENT_ID), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          clientId: CLIENT_ID,
          pattern: 'scheduler@acme.com',
          patternType: 'address',
        });
      });

      expect(createClientSender).toHaveBeenCalledWith({
        clientId: CLIENT_ID,
        pattern: 'scheduler@acme.com',
        patternType: 'address',
      });
    });
  });

  describe('error handling', () => {
    it('propagates error from createClientSender', async () => {
      (createClientSender as jest.Mock).mockRejectedValue(new Error('write failed'));

      const { result } = renderHook(() => useCreateClientSender(CLIENT_ID), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync({
            clientId: CLIENT_ID,
            pattern: 'x@y.com',
            patternType: 'address',
          });
        }),
      ).rejects.toThrow('write failed');
    });
  });
});

describe('useDeleteClientSender', () => {
  describe('happy path', () => {
    it('calls deleteClientSender with the correct id', async () => {
      (deleteClientSender as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteClientSender(CLIENT_ID), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('sender-1');
      });

      expect(deleteClientSender).toHaveBeenCalledWith(CLIENT_ID, 'sender-1');
    });
  });

  describe('error handling', () => {
    it('propagates error from deleteClientSender', async () => {
      (deleteClientSender as jest.Mock).mockRejectedValue(new Error('delete failed'));

      const { result } = renderHook(() => useDeleteClientSender(CLIENT_ID), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.mutateAsync('sender-1');
        }),
      ).rejects.toThrow('delete failed');
    });
  });
});
