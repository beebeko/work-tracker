import { Timestamp } from 'firebase/firestore';

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
  functions: {},
  storage: {},
}));

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '../../lib/firebase';
import { getUserProfile, upsertUserProfile } from '../userProfile';

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp;

beforeEach(() => {
  jest.clearAllMocks();
  (auth as any).currentUser = { uid: 'test-uid' };
});

describe('getUserProfile', () => {
  it('returns profile when document exists', async () => {
    const mockSnap = {
      exists: () => true,
      id: 'test-uid',
      data: () => ({
        name: 'Alice Smith',
        email: 'alice@example.com',
        address: '123 Main St',
        phone: '555-1234',
        updatedAt: mockTimestamp,
      }),
    };
    (doc as jest.Mock).mockReturnValue({});
    (getDoc as jest.Mock).mockResolvedValue(mockSnap);

    const profile = await getUserProfile();
    expect(profile).not.toBeNull();
    expect(profile!.name).toBe('Alice Smith');
    expect(profile!.uid).toBe('test-uid');
  });

  it('returns null when document does not exist', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    const profile = await getUserProfile();
    expect(profile).toBeNull();
  });

  it('throws if not authenticated', async () => {
    (auth as any).currentUser = null;
    await expect(getUserProfile()).rejects.toThrow('Not authenticated');
  });
});

describe('upsertUserProfile', () => {
  it('calls setDoc with merge:true and serverTimestamp', async () => {
    (doc as jest.Mock).mockReturnValue({ id: 'test-uid' });
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    await upsertUserProfile({ name: 'Alice', email: 'alice@example.com' });

    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Alice', email: 'alice@example.com' }),
      { merge: true },
    );
  });

  it('throws if not authenticated', async () => {
    (auth as any).currentUser = null;
    await expect(upsertUserProfile({ name: 'Alice', email: 'alice@example.com' })).rejects.toThrow(
      'Not authenticated',
    );
  });
});
