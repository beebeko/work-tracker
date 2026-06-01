jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  GoogleAuthProvider: jest.fn(() => ({})),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock('../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  googleProvider: {},
  functions: {},
  storage: {},
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { createWrapper } from '../../test-utils/queryWrapper';
import { useGenerateInvoice, useInvoicePdfUrl, useSendInvoice } from '../useInvoiceActions';

const mockCallFn = jest.fn();
const mockedHttpsCallable = httpsCallable as jest.MockedFunction<typeof httpsCallable>;
const mockedGetDownloadURL = getDownloadURL as jest.MockedFunction<typeof getDownloadURL>;
const mockedRef = ref as jest.MockedFunction<typeof ref>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedHttpsCallable.mockReturnValue(mockCallFn);
  mockedRef.mockReturnValue({} as ReturnType<typeof ref>);
});

// ─── useGenerateInvoice ───────────────────────────────────────────────────────

describe('useGenerateInvoice', () => {
  it('calls generateInvoice Cloud Function and returns invoiceId', async () => {
    mockCallFn.mockResolvedValue({ data: { invoiceId: 'inv-123' } });
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGenerateInvoice(), { wrapper });

    let returned: any;
    await act(async () => {
      returned = await result.current.mutateAsync({
        clientId: 'c1',
        gigId: 'g1',
        entryIds: ['e1', 'e2'],
      });
    });

    expect(mockCallFn).toHaveBeenCalledWith({
      clientId: 'c1',
      gigId: 'g1',
      entryIds: ['e1', 'e2'],
    });
    expect(returned).toEqual({ invoiceId: 'inv-123' });
  });

  it('exposes error when Cloud Function throws', async () => {
    mockCallFn.mockRejectedValue(new Error('permission-denied'));
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGenerateInvoice(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ clientId: 'c1', gigId: 'g1', entryIds: [] })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });

  it('passes optional invoiceId for regeneration', async () => {
    mockCallFn.mockResolvedValue({ data: { invoiceId: 'inv-123' } });
    const wrapper = createWrapper();
    const { result } = renderHook(() => useGenerateInvoice(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        clientId: 'c1',
        gigId: 'g1',
        entryIds: ['e1'],
        invoiceId: 'inv-old',
      });
    });

    expect(mockCallFn).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: 'inv-old' }));
  });
});

// ─── useSendInvoice ───────────────────────────────────────────────────────────

describe('useSendInvoice', () => {
  it('calls sendInvoice Cloud Function', async () => {
    mockCallFn.mockResolvedValue({ data: { success: true } });
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSendInvoice(), { wrapper });

    let returned: any;
    await act(async () => {
      returned = await result.current.mutateAsync({
        invoiceId: 'inv-1',
        fromAddress: 'me@example.com',
        toAddress: 'client@example.com',
      });
    });

    expect(mockCallFn).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      fromAddress: 'me@example.com',
      toAddress: 'client@example.com',
    });
    expect(returned).toEqual({ success: true });
  });

  it('exposes error on failure', async () => {
    mockCallFn.mockRejectedValue(new Error('internal'));
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSendInvoice(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ invoiceId: 'i1', fromAddress: 'a', toAddress: 'b' })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── useInvoicePdfUrl ────────────────────────────────────────────────────────

describe('useInvoicePdfUrl', () => {
  it('returns download URL when path is provided', async () => {
    mockedGetDownloadURL.mockResolvedValue('https://storage.example.com/invoice.pdf');
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInvoicePdfUrl('invoices/uid/AP0001.pdf'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('https://storage.example.com/invoice.pdf');
    expect(mockedGetDownloadURL).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when path is undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInvoicePdfUrl(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedGetDownloadURL).not.toHaveBeenCalled();
  });

  it('exposes error when download URL fails', async () => {
    mockedGetDownloadURL.mockRejectedValue(new Error('storage/object-not-found'));
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInvoicePdfUrl('invoices/uid/MISSING.pdf'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
