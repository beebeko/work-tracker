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
  serverTimestamp: jest.fn(() => ({})),
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
  functions: {},
  storage: {},
}));

jest.mock('../../services/emailAccounts');

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { emailAccountFixture } from '../../__fixtures__/entities.fixtures';
import {
    createEmailAccount,
    deleteEmailAccount,
    listEmailAccounts,
    updateEmailAccount,
} from '../../services/emailAccounts';
import { createWrapper } from '../../test-utils/queryWrapper';
import {
    useCreateEmailAccount,
    useDeleteEmailAccount,
    useEmailAccounts,
    useUpdateEmailAccount,
} from '../useEmailAccounts';

beforeEach(() => jest.clearAllMocks());

describe('useEmailAccounts', () => {
  it('fetches and returns the list', async () => {
    (listEmailAccounts as jest.Mock).mockResolvedValue([emailAccountFixture]);

    const { result } = renderHook(() => useEmailAccounts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].displayName).toBe('Work');
  });
});

describe('useCreateEmailAccount', () => {
  it('calls createEmailAccount and returns the new account', async () => {
    (createEmailAccount as jest.Mock).mockResolvedValue(emailAccountFixture);

    const { result } = renderHook(() => useCreateEmailAccount(), { wrapper: createWrapper() });
    let data: typeof emailAccountFixture | undefined;
    await act(async () => {
      data = await result.current.mutateAsync({
        displayName: 'Work',
        fromAddress: 'work@example.com',
        isDefault: true,
      });
    });
    expect(createEmailAccount).toHaveBeenCalled();
    expect(data?.fromAddress).toBe('work@example.com');
  });
});

describe('useUpdateEmailAccount', () => {
  it('calls updateEmailAccount with id and patch', async () => {
    (updateEmailAccount as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateEmailAccount('acc-1'), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync({ displayName: 'Personal' });
    });
    expect(updateEmailAccount).toHaveBeenCalledWith('acc-1', { displayName: 'Personal' });
  });
});

describe('useDeleteEmailAccount', () => {
  it('calls deleteEmailAccount with id', async () => {
    (deleteEmailAccount as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteEmailAccount(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync('acc-1');
    });
    expect(deleteEmailAccount).toHaveBeenCalledWith('acc-1');
  });
});
