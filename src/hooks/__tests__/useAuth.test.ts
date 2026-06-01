jest.mock('firebase/app', () => ({ initializeApp: jest.fn(() => ({})), getApps: jest.fn(() => []), getApp: jest.fn(() => ({})) }));
jest.mock('firebase/firestore', () => ({ getFirestore: jest.fn(() => ({})) }));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  GoogleAuthProvider: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(),
}));
jest.mock('../../lib/firebase', () => ({ db: {}, auth: { currentUser: null }, googleProvider: {} }));

import { renderHook, act } from '@testing-library/react-native';
import * as firebaseAuth from 'firebase/auth';
import { useAuth } from '../useAuth';

const onAuthStateChangedMock = firebaseAuth.onAuthStateChanged as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('useAuth', () => {
  describe('happy path', () => {
    it('starts in loading state', () => {
      onAuthStateChangedMock.mockImplementation(() => () => {});
      const { result } = renderHook(() => useAuth());
      expect(result.current.status).toBe('loading');
      expect(result.current.user).toBeNull();
    });

    it('transitions to authenticated when a user is returned', () => {
      const fakeUser = { uid: 'abc', email: 'a@b.com' };
      onAuthStateChangedMock.mockImplementation((_auth: unknown, callback: (u: unknown) => void) => {
        callback(fakeUser);
        return () => {};
      });
      const { result } = renderHook(() => useAuth());
      expect(result.current.status).toBe('authenticated');
      expect(result.current.user).toEqual(fakeUser);
    });

    it('transitions to unauthenticated when null is returned', () => {
      onAuthStateChangedMock.mockImplementation((_auth: unknown, callback: (u: null) => void) => {
        callback(null);
        return () => {};
      });
      const { result } = renderHook(() => useAuth());
      expect(result.current.status).toBe('unauthenticated');
      expect(result.current.user).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('calls the unsubscribe function on unmount', () => {
      const unsubscribe = jest.fn();
      onAuthStateChangedMock.mockReturnValue(unsubscribe);
      const { unmount } = renderHook(() => useAuth());
      unmount();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('can transition from authenticated to unauthenticated', () => {
      let capturedCallback: ((u: unknown) => void) | null = null;
      onAuthStateChangedMock.mockImplementation((_auth: unknown, cb: (u: unknown) => void) => {
        capturedCallback = cb;
        return () => {};
      });
      const { result } = renderHook(() => useAuth());
      act(() => capturedCallback!({ uid: 'x' }));
      expect(result.current.status).toBe('authenticated');
      act(() => capturedCallback!(null));
      expect(result.current.status).toBe('unauthenticated');
    });
  });
});
