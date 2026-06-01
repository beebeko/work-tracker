jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
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

jest.mock('../../services/userProfile');

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { userProfileFixture } from '../../__fixtures__/entities.fixtures';
import { getUserProfile, upsertUserProfile } from '../../services/userProfile';
import { createWrapper } from '../../test-utils/queryWrapper';
import { useUpsertUserProfile, useUserProfile } from '../useUserProfile';

beforeEach(() => jest.clearAllMocks());

describe('useUserProfile', () => {
  it('fetches and returns the user profile', async () => {
    (getUserProfile as jest.Mock).mockResolvedValue(userProfileFixture);

    const { result } = renderHook(() => useUserProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(userProfileFixture);
  });

  it('returns null when profile does not exist', async () => {
    (getUserProfile as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useUserProfile(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

describe('useUpsertUserProfile', () => {
  it('calls upsertUserProfile and invalidates cache', async () => {
    (upsertUserProfile as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpsertUserProfile(), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Alice', email: 'alice@example.com' });
    });
    expect(upsertUserProfile).toHaveBeenCalledWith({ name: 'Alice', email: 'alice@example.com' });
  });
});
