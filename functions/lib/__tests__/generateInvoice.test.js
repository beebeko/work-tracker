"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Mock firebase-admin before importing anything
const mockDb = {
    collection: jest.fn(),
    runTransaction: jest.fn(),
};
const mockStorage = {
    bucket: jest.fn(),
};
jest.mock('../lib/admin', () => ({
    db: mockDb,
    storage: mockStorage,
    admin: {},
}));
// Mock firebase-functions/v2/https onCall so we can extract the handler
let capturedHandler = null;
jest.mock('firebase-functions/v2/https', () => ({
    onCall: jest.fn((optionsOrHandler, handler) => {
        capturedHandler = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler;
        return capturedHandler;
    }),
    HttpsError: class HttpsError extends Error {
        code;
        constructor(code, message) {
            super(message);
            this.code = code;
            this.name = 'HttpsError';
        }
    },
}));
jest.mock('firebase-functions/params', () => ({
    defineSecret: jest.fn(() => ({ value: () => 'test-key' })),
}));
jest.mock('../lib/pdf', () => ({
    buildPdf: jest.fn().mockResolvedValue(new Uint8Array([37, 80, 68, 70])),
}));
const generateInvoice_1 = require("../generateInvoice");
// ─── Helpers ─────────────────────────────────────────────────────────────────
const FieldValueSentinel = { _INCREMENT: true };
// Build mock Firestore doc snapshot
function makeSnap(data, exists = true) {
    return { exists, data: () => data, id: 'mock-id' };
}
const clientData = {
    name: 'Acme',
    email: 'acme@test.com',
    overtimeRules: {
        weeklyThresholdHours: 40,
        weeklyOvertimeMultiplier: 1.5,
        weekStartDay: 1,
        mealPenaltyEnabled: false,
        mealPenaltyWindowHours: 6,
        mealPenaltyRateHours: 0.5,
    },
    invoicePrefix: 'AC',
    nextInvoiceSeq: 1,
};
const gigData = { name: 'Feature Film 2026', clientId: 'client-1' };
const profileData = { name: 'Alice', email: 'alice@test.com' };
const entryData = {
    type: 'lump_sum',
    date: '2026-05-25',
    amount: 500,
    description: 'Kit rental',
    ownerUid: 'test-uid',
    gigId: 'gig-1',
};
function makeRequest(data, uid = 'test-uid') {
    return { auth: { uid }, data };
}
function setupMocks() {
    const bucket = { file: jest.fn() };
    bucket.file.mockReturnValue({ save: jest.fn().mockResolvedValue(undefined) });
    mockStorage.bucket.mockReturnValue(bucket);
    const newInvoiceRef = { set: jest.fn().mockResolvedValue(undefined), id: 'new-invoice-id' };
    // runTransaction: receives a callback and executes it with a mock tx object
    const tx = {
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
    };
    mockDb.runTransaction = jest.fn().mockImplementation(async (cb) => {
        // Provide a fresh client snap inside the transaction
        tx.get.mockResolvedValue({
            exists: true,
            data: () => ({ ...clientData, ownerUid: 'test-uid' }),
            id: 'client-1',
        });
        return cb(tx);
    });
    const clientDoc = {
        get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ ...clientData, ownerUid: 'test-uid' }), id: 'client-1' }),
        update: jest.fn().mockResolvedValue(undefined),
    };
    const gigDoc = { get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ ...gigData, ownerUid: 'test-uid' }), id: 'gig-1' }) };
    const profileDoc = { get: jest.fn().mockResolvedValue({ exists: true, data: () => profileData, id: 'test-uid' }) };
    const entryDoc = { get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ ...entryData, ownerUid: 'test-uid' }), id: 'entry-1' }) };
    const positionDoc = { get: jest.fn().mockResolvedValue({ exists: false }) };
    const existingInvoiceDoc = {
        get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
                invoiceNumber: 'AC0001',
                ownerUid: 'test-uid',
                lineItems: [],
                subtotal: 500,
                totalAmount: 500,
                entryIds: ['entry-old'],
                pdfStoragePath: 'invoices/test-uid/AC0001.pdf',
            }),
            id: 'existing-invoice-id',
        }),
        update: jest.fn().mockResolvedValue(undefined),
    };
    const invoicesCollection = {
        doc: jest.fn().mockImplementation((id) => {
            if (id === 'existing-invoice-id')
                return existingInvoiceDoc;
            return newInvoiceRef;
        }),
    };
    mockDb.collection.mockImplementation((name) => {
        if (name === 'userProfiles')
            return { doc: jest.fn().mockReturnValue(profileDoc) };
        if (name === 'clients')
            return { doc: jest.fn().mockReturnValue(clientDoc) };
        if (name === 'gigs')
            return { doc: jest.fn().mockReturnValue(gigDoc) };
        if (name === 'workEntries')
            return { doc: jest.fn().mockReturnValue(entryDoc) };
        if (name === 'positions')
            return { doc: jest.fn().mockReturnValue(positionDoc) };
        if (name === 'invoices')
            return invoicesCollection;
        return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) }) };
    });
    return { newInvoiceRef, existingInvoiceDoc, tx };
}
// ─── Tests ────────────────────────────────────────────────────────────────────
beforeEach(() => {
    jest.clearAllMocks();
});
describe('generateInvoice', () => {
    it('is defined', () => {
        expect(generateInvoice_1.generateInvoice).toBeDefined();
        expect(capturedHandler).not.toBeNull();
    });
    it('throws unauthenticated if no auth', async () => {
        await expect(capturedHandler({ auth: null, data: { clientId: 'c1', gigId: 'g1', entryIds: [] } })).rejects.toMatchObject({ code: 'unauthenticated' });
    });
    it('throws invalid-argument if required fields missing', async () => {
        await expect(capturedHandler(makeRequest({ gigId: 'g1', entryIds: [] }))).rejects.toMatchObject({ code: 'invalid-argument' });
    });
    it('throws not-found if client does not exist', async () => {
        mockStorage.bucket.mockReturnValue({ file: jest.fn() });
        mockDb.collection.mockImplementation((name) => {
            if (name === 'clients')
                return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) }) };
            if (name === 'gigs')
                return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: true, data: () => gigData, id: 'gig-1' }) }) };
            if (name === 'userProfiles')
                return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) }) };
            return { doc: jest.fn() };
        });
        await expect(capturedHandler(makeRequest({ clientId: 'bad', gigId: 'g1', entryIds: [] }))).rejects.toMatchObject({ code: 'not-found' });
    });
    it('creates a new invoice and returns invoiceId', async () => {
        const { tx } = setupMocks();
        const result = await capturedHandler(makeRequest({ clientId: 'client-1', gigId: 'gig-1', entryIds: ['entry-1'] }));
        expect(result).toHaveProperty('invoiceId');
        // Transaction set was called for the new invoice doc
        expect(tx.set).toHaveBeenCalled();
        // Transaction update was called to increment nextInvoiceSeq
        expect(tx.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ nextInvoiceSeq: expect.anything() }));
    });
    it('throws permission-denied if client belongs to a different user', async () => {
        setupMocks();
        // Override client doc to return a different ownerUid
        const otherClientDoc = {
            get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({ ...clientData, ownerUid: 'other-uid' }),
                id: 'client-1',
            }),
        };
        mockDb.collection.mockImplementation((name) => {
            if (name === 'clients')
                return { doc: jest.fn().mockReturnValue(otherClientDoc) };
            if (name === 'gigs')
                return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ ...gigData, ownerUid: 'test-uid' }), id: 'gig-1' }) }) };
            if (name === 'userProfiles')
                return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) }) };
            return { doc: jest.fn() };
        });
        await expect(capturedHandler(makeRequest({ clientId: 'client-1', gigId: 'gig-1', entryIds: [] }))).rejects.toMatchObject({ code: 'permission-denied' });
    });
    it('throws permission-denied if gig belongs to a different user', async () => {
        setupMocks();
        const otherGigDoc = {
            get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({ ...gigData, ownerUid: 'other-uid' }),
                id: 'gig-1',
            }),
        };
        const clientDoc = {
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ ...clientData, ownerUid: 'test-uid' }), id: 'client-1' }),
        };
        mockDb.collection.mockImplementation((name) => {
            if (name === 'clients')
                return { doc: jest.fn().mockReturnValue(clientDoc) };
            if (name === 'gigs')
                return { doc: jest.fn().mockReturnValue(otherGigDoc) };
            if (name === 'userProfiles')
                return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) }) };
            return { doc: jest.fn() };
        });
        await expect(capturedHandler(makeRequest({ clientId: 'client-1', gigId: 'gig-1', entryIds: [] }))).rejects.toMatchObject({ code: 'permission-denied' });
    });
    it('regenerates an existing invoice and archives history', async () => {
        const { existingInvoiceDoc } = setupMocks();
        const result = await capturedHandler(makeRequest({ clientId: 'client-1', gigId: 'gig-1', entryIds: ['entry-1'], invoiceId: 'existing-invoice-id' }));
        expect(result).toEqual({ invoiceId: 'existing-invoice-id' });
        expect(existingInvoiceDoc.update).toHaveBeenCalledWith(expect.objectContaining({
            history: expect.anything(), // FieldValue.arrayUnion
            status: 'draft',
        }));
    });
    it('throws not-found when regenerating a non-existent invoice', async () => {
        setupMocks();
        // Override invoices collection to return non-existent snap for the invoice doc
        mockDb.collection.mockImplementation((name) => {
            if (name === 'invoices')
                return {
                    doc: jest.fn().mockReturnValue({
                        get: jest.fn().mockResolvedValue({ exists: false }),
                        update: jest.fn(),
                    }),
                };
            if (name === 'clients')
                return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ ...clientData, ownerUid: 'test-uid' }), id: 'client-1' }) }) };
            if (name === 'gigs')
                return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ ...gigData, ownerUid: 'test-uid' }), id: 'gig-1' }) }) };
            if (name === 'userProfiles')
                return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) }) };
            if (name === 'workEntries')
                return { doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) }) };
            return { doc: jest.fn() };
        });
        await expect(capturedHandler(makeRequest({ clientId: 'client-1', gigId: 'gig-1', entryIds: [], invoiceId: 'missing-invoice' }))).rejects.toMatchObject({ code: 'not-found' });
    });
    it('throws permission-denied when regenerating an invoice owned by another user', async () => {
        const { existingInvoiceDoc } = setupMocks();
        existingInvoiceDoc.get.mockResolvedValue({
            exists: true,
            data: () => ({
                invoiceNumber: 'AC0001',
                ownerUid: 'other-uid', // different user
                lineItems: [],
                subtotal: 500,
                totalAmount: 500,
                entryIds: [],
                pdfStoragePath: 'invoices/other/AC0001.pdf',
            }),
            id: 'existing-invoice-id',
        });
        await expect(capturedHandler(makeRequest({ clientId: 'client-1', gigId: 'gig-1', entryIds: [], invoiceId: 'existing-invoice-id' }))).rejects.toMatchObject({ code: 'permission-denied' });
    });
});
