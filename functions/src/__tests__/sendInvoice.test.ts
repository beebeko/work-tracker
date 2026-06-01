const mockDb = {
  collection: jest.fn(),
};
const mockStorage = {
  bucket: jest.fn(),
};

jest.mock('../lib/admin', () => ({
  db: mockDb,
  storage: mockStorage,
  admin: {},
}));

let capturedHandler: ((req: any) => Promise<any>) | null = null;

jest.mock('firebase-functions/v2/https', () => ({
  onCall: jest.fn((optionsOrHandler: any, handler?: any) => {
    capturedHandler = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler!;
    return capturedHandler;
  }),
  HttpsError: class HttpsError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
      this.name = 'HttpsError';
    }
  },
}));

jest.mock('firebase-functions/params', () => ({
  defineSecret: jest.fn(() => ({ value: () => 'test-resend-key' })),
}));

// Mock Resend
const mockSendFn = jest.fn().mockResolvedValue({ error: null, data: { id: 'email-id' } });
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSendFn },
  })),
}));

import { sendInvoice } from '../sendInvoice';

const invoiceData = {
  invoiceNumber: 'AP0001',
  status: 'draft',
  pdfStoragePath: 'invoices/uid/AP0001.pdf',
  ownerUid: 'test-uid',
};

function makeRequest(data: object, uid = 'test-uid') {
  return { auth: { uid }, data };
}

function setupMocks(invoiceOverrides = {}) {
  const bucket = { file: jest.fn() };
  bucket.file.mockReturnValue({ download: jest.fn().mockResolvedValue([Buffer.from('%PDF-mock')]) });
  mockStorage.bucket.mockReturnValue(bucket);

  const invoiceDoc = {
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({ ...invoiceData, ...invoiceOverrides }),
      id: 'invoice-1',
    }),
    update: jest.fn().mockResolvedValue(undefined),
  };

  mockDb.collection.mockImplementation(() => ({
    doc: jest.fn().mockReturnValue(invoiceDoc),
  }));

  return { invoiceDoc };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sendInvoice', () => {
  it('is defined', () => {
    expect(sendInvoice).toBeDefined();
    expect(capturedHandler).not.toBeNull();
  });

  it('throws unauthenticated if no auth', async () => {
    await expect(
      capturedHandler!({ auth: null, data: { invoiceId: 'i1', fromAddress: 'a', toAddress: 'b' } }),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('throws invalid-argument if required fields missing', async () => {
    await expect(
      capturedHandler!(makeRequest({ invoiceId: 'i1' })),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws not-found if invoice does not exist', async () => {
    mockStorage.bucket.mockReturnValue({ file: jest.fn() });
    mockDb.collection.mockImplementation(() => ({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ exists: false }),
      }),
    }));

    await expect(
      capturedHandler!(makeRequest({ invoiceId: 'bad', fromAddress: 'a@x.com', toAddress: 'b@x.com' })),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('throws failed-precondition if invoice has no pdfStoragePath', async () => {
    setupMocks({ pdfStoragePath: null });

    await expect(
      capturedHandler!(
        makeRequest({ invoiceId: 'invoice-1', fromAddress: 'a@x.com', toAddress: 'b@x.com' }),
      ),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('sends email and updates status to sent on success', async () => {
    const { invoiceDoc } = setupMocks();

    const result = await capturedHandler!(
      makeRequest({ invoiceId: 'invoice-1', fromAddress: 'a@x.com', toAddress: 'b@x.com' }),
    );

    expect(mockSendFn).toHaveBeenCalled();
    expect(invoiceDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent' }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws internal on Resend failure', async () => {
    setupMocks();
    mockSendFn.mockResolvedValueOnce({ error: { message: 'Rate limited' }, data: null });

    await expect(
      capturedHandler!(
        makeRequest({ invoiceId: 'invoice-1', fromAddress: 'a@x.com', toAddress: 'b@x.com' }),
      ),
    ).rejects.toMatchObject({ code: 'internal' });
  });

  it('throws permission-denied when invoice belongs to another user', async () => {
    setupMocks({ ownerUid: 'other-uid' });

    await expect(
      capturedHandler!(
        makeRequest({ invoiceId: 'invoice-1', fromAddress: 'a@x.com', toAddress: 'b@x.com' }, 'test-uid'),
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
