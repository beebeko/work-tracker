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
  query: jest.fn((...a: unknown[]) => a[0]),
  orderBy: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => ({})),
  Timestamp: { now: jest.fn(), fromDate: jest.fn() },
}));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: 'test-uid' } })),
  GoogleAuthProvider: jest.fn(() => ({})),
}));
jest.mock('../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  googleProvider: {},
}));
jest.mock('../../services/invoices');

import { renderHook, waitFor } from '@testing-library/react-native';
import { invoiceFixture } from '../../__fixtures__/entities.fixtures';
import * as invoicesService from '../../services/invoices';
import { createWrapper } from '../../test-utils/queryWrapper';
import {
    useCreateInvoice,
    useDeleteInvoice,
    useInvoice,
    useInvoices,
    useInvoicesByClient,
    useUpdateInvoice,
} from '../useInvoices';

const listInvoicesMock = invoicesService.listInvoices as jest.Mock;
const listInvoicesByClientMock = invoicesService.listInvoicesByClient as jest.Mock;
const getInvoiceMock = invoicesService.getInvoice as jest.Mock;
const createInvoiceMock = invoicesService.createInvoice as jest.Mock;
const updateInvoiceMock = invoicesService.updateInvoice as jest.Mock;
const deleteInvoiceMock = invoicesService.deleteInvoice as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('useInvoices', () => {
  describe('happy path', () => {
    it('calls listInvoices and returns data', async () => {
      listInvoicesMock.mockResolvedValueOnce([invoiceFixture]);
      const { result } = renderHook(() => useInvoices(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([invoiceFixture]);
    });
  });

  describe('error handling', () => {
    it('exposes error when listInvoices rejects', async () => {
      listInvoicesMock.mockRejectedValueOnce(new Error('Firestore error'));
      const { result } = renderHook(() => useInvoices(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});

describe('useInvoicesByClient', () => {
  describe('happy path', () => {
    it('calls listInvoicesByClient with clientId', async () => {
      listInvoicesByClientMock.mockResolvedValueOnce([invoiceFixture]);
      const { result } = renderHook(() => useInvoicesByClient('client-1'), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listInvoicesByClientMock).toHaveBeenCalledWith('client-1');
    });
  });

  describe('edge cases', () => {
    it('does not fetch when clientId is empty', () => {
      const { result } = renderHook(() => useInvoicesByClient(''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useInvoice', () => {
  describe('happy path', () => {
    it('calls getInvoice with the given id', async () => {
      getInvoiceMock.mockResolvedValueOnce(invoiceFixture);
      const { result } = renderHook(() => useInvoice('invoice-1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getInvoiceMock).toHaveBeenCalledWith('invoice-1');
    });
  });

  describe('edge cases', () => {
    it('does not fetch when id is empty', () => {
      const { result } = renderHook(() => useInvoice(''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useCreateInvoice', () => {
  describe('happy path', () => {
    it('calls createInvoice on mutate', async () => {
      createInvoiceMock.mockResolvedValueOnce(invoiceFixture);
      const { result } = renderHook(() => useCreateInvoice(), { wrapper: createWrapper() });
      result.current.mutate({
        clientId: 'client-1',
        gigId: 'gig-1',
        invoiceNumber: 'INV-001',
        status: 'draft',
        lineItems: [],
        subtotal: 0,
        totalAmount: 0,
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(createInvoiceMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useUpdateInvoice', () => {
  describe('happy path', () => {
    it('calls updateInvoice on mutate', async () => {
      updateInvoiceMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useUpdateInvoice('invoice-1'), {
        wrapper: createWrapper(),
      });
      result.current.mutate({ status: 'sent' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(updateInvoiceMock).toHaveBeenCalledWith('invoice-1', { status: 'sent' });
    });
  });
});

describe('useDeleteInvoice', () => {
  describe('happy path', () => {
    it('calls deleteInvoice on mutate', async () => {
      deleteInvoiceMock.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useDeleteInvoice(), { wrapper: createWrapper() });
      result.current.mutate('invoice-1');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(deleteInvoiceMock).toHaveBeenCalledWith('invoice-1');
    });
  });
});
