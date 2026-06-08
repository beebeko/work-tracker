jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({ getFirestore: jest.fn(() => ({})) }));
jest.mock('firebase/functions', () => ({ getFunctions: jest.fn(() => ({})) }));
jest.mock('firebase/storage', () => ({ getStorage: jest.fn(() => ({})) }));

// All firebase/auth mock state lives inside the factory and is exposed via globalThis
// so we can reach it from the test body without TDZ issues (jest.mock + imports are hoisted
// above the test file's const declarations).
type FirebaseAuthState = {
  signInWithPopup: jest.Mock;
  signInWithCredential: jest.Mock;
  credentialFactory: jest.Mock;
};

jest.mock('firebase/auth', () => {
  const signInWithPopup = jest.fn();
  const signInWithCredential = jest.fn();
  const credentialFactory = jest.fn(() => ({ providerId: 'google.com' }));
  const GoogleAuthProvider = jest.fn(() => ({}));
  (GoogleAuthProvider as unknown as { credential: jest.Mock }).credential = credentialFactory;
  (
    globalThis as unknown as { __mockFirebaseAuthState: FirebaseAuthState }
  ).__mockFirebaseAuthState = { signInWithPopup, signInWithCredential, credentialFactory };
  return {
    getAuth: jest.fn(() => ({})),
    GoogleAuthProvider,
    signInWithPopup,
    signInWithCredential,
  };
});
const {
  signInWithPopup: mockSignInWithPopup,
  signInWithCredential: mockSignInWithCredential,
  credentialFactory: mockCredentialFactory,
} = (globalThis as unknown as { __mockFirebaseAuthState: FirebaseAuthState })
  .__mockFirebaseAuthState;

jest.mock('@/src/lib/firebase', () => ({
  auth: {},
  googleProvider: {},
}));

const mockPromptAsync = jest.fn();
type GoogleResponse =
  | { type: 'success'; params?: { id_token?: string } }
  | { type: 'error'; error?: { message?: string } }
  | { type: 'cancel' }
  | { type: 'dismiss' }
  | null;

// State held in module scope and exposed via globalThis so the (hoisted) mock factory can
// see it without hitting TDZ on the const declarations.
type SharedState = { response: GoogleResponse; request: object | null };
(globalThis as unknown as { __mockGoogleAuthState: SharedState }).__mockGoogleAuthState = {
  response: null,
  request: { url: 'x' },
};
const mockGoogleAuthState = (globalThis as unknown as { __mockGoogleAuthState: SharedState })
  .__mockGoogleAuthState;

jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: () => {
    const s = (globalThis as unknown as { __mockGoogleAuthState: SharedState })
      .__mockGoogleAuthState;
    return [s.request, s.response, mockPromptAsync];
  },
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-constants', () => {
  const state: { executionEnvironment: string } = { executionEnvironment: 'standalone' };
  (globalThis as unknown as { __mockExpoConstantsState: typeof state }).__mockExpoConstantsState =
    state;
  return {
    __esModule: true,
    default: state,
    ExecutionEnvironment: {
      Bare: 'bare',
      Standalone: 'standalone',
      StoreClient: 'storeClient',
    },
  };
});
const mockConstants = (
  globalThis as unknown as { __mockExpoConstantsState: { executionEnvironment: string } }
).__mockExpoConstantsState;
const { ExecutionEnvironment } = jest.requireMock('expo-constants') as {
  ExecutionEnvironment: { Bare: string; Standalone: string; StoreClient: string };
};

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
  OS: 'ios',
  select: (o: Record<string, unknown>) => o.ios ?? o.default,
}));

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import SignInScreen from '../sign-in';

function setPlatform(os: 'ios' | 'android' | 'web') {
  (Platform as unknown as { OS: string }).OS = os;
}

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConstants.executionEnvironment = ExecutionEnvironment.Standalone;
    mockGoogleAuthState.response = null;
    mockGoogleAuthState.request = { url: 'x' };
    setPlatform('ios');
  });

  describe('handleSignIn — platform branching', () => {
    it('uses signInWithPopup on web', async () => {
      setPlatform('web');
      mockSignInWithPopup.mockResolvedValue({});

      render(<SignInScreen />);
      fireEvent.press(screen.getByLabelText('Sign in with Google'));

      await waitFor(() => {
        expect(mockSignInWithPopup).toHaveBeenCalled();
      });
      expect(mockPromptAsync).not.toHaveBeenCalled();
    });

    it('calls promptAsync on native dev builds', async () => {
      mockPromptAsync.mockResolvedValue({ type: 'cancel' });

      render(<SignInScreen />);
      fireEvent.press(screen.getByLabelText('Sign in with Google'));

      await waitFor(() => {
        expect(mockPromptAsync).toHaveBeenCalled();
      });
    });

    it('shows a friendly error and does not call promptAsync when running in Expo Go', async () => {
      mockConstants.executionEnvironment = ExecutionEnvironment.StoreClient;

      render(<SignInScreen />);
      fireEvent.press(screen.getByLabelText('Sign in with Google'));

      await waitFor(() => {
        expect(screen.getByText(/not supported in Expo Go/i)).toBeTruthy();
      });
      expect(mockPromptAsync).not.toHaveBeenCalled();
    });

    it('surfaces an error when promptAsync throws synchronously', async () => {
      mockPromptAsync.mockImplementation(() => {
        throw new Error('boom');
      });

      render(<SignInScreen />);
      fireEvent.press(screen.getByLabelText('Sign in with Google'));

      await waitFor(() => {
        expect(screen.getByText(/Sign in failed: boom/)).toBeTruthy();
      });
    });

    it('surfaces an error when signInWithPopup rejects', async () => {
      setPlatform('web');
      mockSignInWithPopup.mockRejectedValue(new Error('popup blocked'));

      render(<SignInScreen />);
      fireEvent.press(screen.getByLabelText('Sign in with Google'));

      await waitFor(() => {
        expect(screen.getByText(/Sign in failed: popup blocked/)).toBeTruthy();
      });
    });
  });

  describe('response handling', () => {
    it('signs in via signInWithCredential on success', async () => {
      mockSignInWithCredential.mockResolvedValue({});

      const { rerender } = render(<SignInScreen />);
      mockGoogleAuthState.response = { type: 'success', params: { id_token: 'fake-token' } };
      act(() => {
        rerender(<SignInScreen />);
      });

      await waitFor(() => {
        expect(mockCredentialFactory).toHaveBeenCalledWith('fake-token');
        expect(mockSignInWithCredential).toHaveBeenCalled();
      });
    });

    it('shows missing-id_token error when success response lacks id_token', async () => {
      const { rerender } = render(<SignInScreen />);
      mockGoogleAuthState.response = { type: 'success', params: {} };
      act(() => {
        rerender(<SignInScreen />);
      });

      await waitFor(() => {
        expect(screen.getByText(/missing id_token/i)).toBeTruthy();
      });
      expect(mockSignInWithCredential).not.toHaveBeenCalled();
    });

    it('surfaces an error when signInWithCredential rejects (mid-process failure)', async () => {
      mockSignInWithCredential.mockRejectedValue(new Error('network down'));

      const { rerender } = render(<SignInScreen />);
      mockGoogleAuthState.response = { type: 'success', params: { id_token: 'tok' } };
      act(() => {
        rerender(<SignInScreen />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Sign in failed: network down/)).toBeTruthy();
      });
    });

    it('shows an error when the auth response itself is an error', async () => {
      const { rerender } = render(<SignInScreen />);
      mockGoogleAuthState.response = { type: 'error', error: { message: 'bad scope' } };
      act(() => {
        rerender(<SignInScreen />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Sign in failed: bad scope/)).toBeTruthy();
      });
    });

    it('clears loading without an error when user cancels', async () => {
      mockPromptAsync.mockResolvedValue({ type: 'cancel' });

      const { rerender } = render(<SignInScreen />);
      fireEvent.press(screen.getByLabelText('Sign in with Google'));
      await waitFor(() => expect(mockPromptAsync).toHaveBeenCalled());

      mockGoogleAuthState.response = { type: 'cancel' };
      act(() => {
        rerender(<SignInScreen />);
      });

      expect(screen.queryByText(/Sign in failed/i)).toBeNull();
    });
  });
});
