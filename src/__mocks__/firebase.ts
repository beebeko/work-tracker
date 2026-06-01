// Jest mock for firebase/firestore and firebase/auth
// Usage: import at the top of a test file, or via moduleNameMapper in jest config.
// All functions are jest.fn() — override per-test with mockResolvedValueOnce etc.

const mockTimestamp = {
  toDate: () => new Date('2026-01-01T00:00:00Z'),
  seconds: 1735689600,
  nanoseconds: 0,
};

const mockServerTimestamp = () => mockTimestamp;

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockQuery = jest.fn((...args: unknown[]) => args[0]);
const mockOrderBy = jest.fn();
const mockWhere = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  query: mockQuery,
  orderBy: mockOrderBy,
  where: mockWhere,
  onSnapshot: mockOnSnapshot,
  serverTimestamp: mockServerTimestamp,
  Timestamp: {
    now: () => mockTimestamp,
    fromDate: (d: Date) => ({ ...mockTimestamp, seconds: Math.floor(d.getTime() / 1000) }),
  },
}));

const mockSignInWithPopup = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn();

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-uid' } })),
  GoogleAuthProvider: jest.fn(() => ({})),
  signInWithPopup: mockSignInWithPopup,
  signOut: mockSignOut,
  onAuthStateChanged: mockOnAuthStateChanged,
}));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

// Re-export mocks so tests can import and configure them
export {
  mockAddDoc,
  mockCollection,
  mockDeleteDoc,
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockOnAuthStateChanged,
  mockOnSnapshot,
  mockOrderBy,
  mockQuery,
  mockServerTimestamp,
  mockSetDoc,
  mockSignInWithPopup,
  mockSignOut,
  mockTimestamp,
  mockUpdateDoc,
  mockWhere,
};
