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
}));

import {
    addDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { invoiceFixture } from '../../__fixtures__/entities.fixtures';
import { auth } from '../../lib/firebase';
import {
    createInvoice,
    deleteInvoice,
    getInvoice,
    listInvoices,
    listInvoicesByClient,
    updateInvoice,
} from '../invoices';

const mockTimestamp = { toDate: () => new Date('2026-01-01') } as unknown as Timestamp;

function makeInvoiceDoc(overrides = {}) {
  return {
    id: invoiceFixture.id,
    exists: () => true,
    data: () => ({
      clientId: 'client-1',
      gigId: 'gig-1',
      ownerUid: 'test-uid',
      invoiceNumber: 'INV-001',
      status: 'draft',
      lineItems: invoiceFixture.lineItems,
      subtotal: 967.5,
      totalAmount: 967.5,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
      ...overrides,
    }),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('listInvoices', () => {
  describe('happy path', () => {
    it('returns invoices owned by the current user', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [makeInvoiceDoc()] });
      const result = await listInvoices();
      expect(result).toHaveLength(1);
      expect(result[0].invoiceNumber).toBe('INV-001');
      expect(where).toHaveBeenCalledWith('ownerUid', '==', 'test-uid');
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('returns empty array when no invoices', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [] });
      expect(await listInvoices()).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws when not authenticated', async () => {
      (auth as { currentUser: { uid: string } | null }).currentUser = null;
      await expect(listInvoices()).rejects.toThrow('Not authenticated');
      (auth as { currentUser: { uid: string } | null }).currentUser = { uid: 'test-uid' };
    });

    it('throws when Firestore rejects', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));
      await expect(listInvoices()).rejects.toThrow('Firestore error');
    });
  });
});

describe('listInvoicesByClient', () => {
  describe('happy path', () => {
    it('filters by clientId', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [makeInvoiceDoc()] });
      await listInvoicesByClient('client-1');
      expect(where).toHaveBeenCalledWith('clientId', '==', 'client-1');
    });
  });
});

describe('getInvoice', () => {
  describe('happy path', () => {
    it('returns the invoice by id', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce(makeInvoiceDoc());
      const result = await getInvoice('invoice-1');
      expect(result.totalAmount).toBe(967.5);
    });
  });

  describe('error handling', () => {
    it('throws when invoice not found', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
      await expect(getInvoice('missing')).rejects.toThrow('Invoice missing not found');
    });
  });
});

describe('createInvoice', () => {
  describe('happy path', () => {
    it('creates an invoice and returns the full document', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'new-inv' });
      (getDoc as jest.Mock).mockResolvedValueOnce({ ...makeInvoiceDoc(), id: 'new-inv' });
      await createInvoice({
        clientId: 'client-1',
        gigId: 'gig-1',
        invoiceNumber: 'INV-002',
        status: 'draft',
        lineItems: [],
        subtotal: 0,
        totalAmount: 0,
      });
      expect(addDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ ownerUid: 'test-uid', invoiceNumber: 'INV-002' }),
      );
    });
  });

  describe('error handling', () => {
    it('throws when not authenticated', async () => {
      (auth as { currentUser: { uid: string } | null }).currentUser = null;
      await expect(
        createInvoice({
          clientId: 'client-1',
          gigId: 'gig-1',
          invoiceNumber: 'INV-002',
          status: 'draft',
          lineItems: [],
          subtotal: 0,
          totalAmount: 0,
        }),
      ).rejects.toThrow('Not authenticated');
      (auth as { currentUser: { uid: string } | null }).currentUser = { uid: 'test-uid' };
    });
  });
});

describe('updateInvoice', () => {
  describe('happy path', () => {
    it('calls updateDoc with the patch', async () => {
      (updateDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await updateInvoice('invoice-1', { status: 'sent' });
      expect(updateDoc).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ status: 'sent' }),
      );
    });
  });
});

describe('deleteInvoice', () => {
  describe('happy path', () => {
    it('calls deleteDoc with the correct ref', async () => {
      (deleteDoc as jest.Mock).mockResolvedValueOnce(undefined);
      await deleteInvoice('invoice-1');
      expect(doc).toHaveBeenCalledWith({}, 'invoices', 'invoice-1');
    });
  });
});
