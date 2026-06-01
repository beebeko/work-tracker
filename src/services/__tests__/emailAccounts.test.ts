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

jest.mock('../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  googleProvider: {},
  functions: {},
  storage: {},
}));

import { addDoc, deleteDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { emailAccountFixture } from '../../__fixtures__/entities.fixtures';
import { auth } from '../../lib/firebase';
import {
    createEmailAccount,
    deleteEmailAccount,
    listEmailAccounts,
    updateEmailAccount,
} from '../emailAccounts';

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp;

function makeAccountDoc(overrides = {}) {
  return {
    id: emailAccountFixture.id,
    exists: () => true,
    data: () => ({
      ownerUid: 'test-uid',
      displayName: emailAccountFixture.displayName,
      fromAddress: emailAccountFixture.fromAddress,
      isDefault: emailAccountFixture.isDefault,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      ...overrides,
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (auth as any).currentUser = { uid: 'test-uid' };
});

describe('listEmailAccounts', () => {
  it('returns accounts for current user', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [makeAccountDoc()],
    });
    const accounts = await listEmailAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].displayName).toBe(emailAccountFixture.displayName);
  });

  it('throws if not authenticated', async () => {
    (auth as any).currentUser = null;
    await expect(listEmailAccounts()).rejects.toThrow('Not authenticated');
  });
});

describe('createEmailAccount', () => {
  it('adds doc and re-fetches to return account with id', async () => {
    (addDoc as jest.Mock).mockResolvedValue({ id: 'acc-1' });
    (doc as jest.Mock).mockReturnValue({});
    (getDoc as jest.Mock).mockResolvedValue(makeAccountDoc());

    const account = await createEmailAccount({
      displayName: 'Work',
      fromAddress: 'work@example.com',
      isDefault: false,
    });

    expect(addDoc).toHaveBeenCalled();
    expect(account.fromAddress).toBe(emailAccountFixture.fromAddress);
  });
});

describe('updateEmailAccount', () => {
  it('calls updateDoc with patch and updatedAt', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    await updateEmailAccount('acc-1', { displayName: 'Personal' });
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ displayName: 'Personal' }),
    );
  });
});

describe('deleteEmailAccount', () => {
  it('calls deleteDoc', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (deleteDoc as jest.Mock).mockResolvedValue(undefined);

    await deleteEmailAccount('acc-1');
    expect(deleteDoc).toHaveBeenCalled();
  });
});
