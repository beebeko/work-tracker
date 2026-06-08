"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pdf_1 = require("../lib/pdf");
const baseData = {
    invoiceNumber: 'AP0001',
    issueDate: '2026-05-25',
    senderName: 'Alice Smith',
    clientName: 'Acme Productions',
    gigName: 'Feature Film 2026',
    lineItems: [
        { description: 'Key Grip — Regular (wk of May 25)', hours: 8, rate: 50, amount: 400 },
        { description: 'Box Rental', amount: 200 },
    ],
    subtotal: 600,
    totalAmount: 600,
};
describe('buildPdf', () => {
    it('returns a non-empty Uint8Array', async () => {
        const bytes = await (0, pdf_1.buildPdf)(baseData);
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes.length).toBeGreaterThan(0);
    });
    it('starts with the PDF magic bytes %PDF-', async () => {
        const bytes = await (0, pdf_1.buildPdf)(baseData);
        const header = String.fromCharCode(...bytes.slice(0, 5));
        expect(header).toBe('%PDF-');
    });
    it('handles missing optional fields (dueDate, notes, senderAddress, senderPhone)', async () => {
        const minimal = {
            invoiceNumber: 'INV-001',
            issueDate: '2026-05-25',
            senderName: 'Bob',
            clientName: 'Client Co',
            gigName: 'Gig',
            lineItems: [],
            subtotal: 0,
            totalAmount: 0,
        };
        await expect((0, pdf_1.buildPdf)(minimal)).resolves.toBeInstanceOf(Uint8Array);
    });
    it('handles empty line items', async () => {
        const noItems = { ...baseData, lineItems: [], subtotal: 0, totalAmount: 0 };
        await expect((0, pdf_1.buildPdf)(noItems)).resolves.toBeInstanceOf(Uint8Array);
    });
    it('includes notes section when notes provided', async () => {
        const withNotes = { ...baseData, notes: 'Payment due net 30' };
        const bytes = await (0, pdf_1.buildPdf)(withNotes);
        // PDF will be larger with extra content
        const bytesNoNotes = await (0, pdf_1.buildPdf)(baseData);
        expect(bytes.length).toBeGreaterThan(bytesNoNotes.length);
    });
    it('renders all optional fields without throwing', async () => {
        const withAllOptionals = {
            ...baseData,
            dueDate: '2026-06-25',
            senderAddress: '123 Main St\nLos Angeles, CA 90001',
            senderPhone: '555-0100',
            clientEmail: 'billing@acme.com',
            clientAddress: '456 Elm Ave\nNew York, NY 10001',
            notes: 'Net 30 terms.',
        };
        await expect((0, pdf_1.buildPdf)(withAllOptionals)).resolves.toBeInstanceOf(Uint8Array);
    });
    it('omits optional fields when all undefined', async () => {
        const noOptionals = {
            invoiceNumber: 'AP0002',
            issueDate: '2026-05-25',
            senderName: 'Alice',
            clientName: 'Client',
            gigName: 'Gig',
            lineItems: [{ description: 'Work', amount: 100 }],
            subtotal: 100,
            totalAmount: 100,
            // dueDate, senderAddress, senderPhone, clientEmail, clientAddress, notes all absent
        };
        await expect((0, pdf_1.buildPdf)(noOptionals)).resolves.toBeInstanceOf(Uint8Array);
    });
    it('throws when too many line items cause overflow', async () => {
        // Generate enough line items so the y position drops below 100
        const manyItems = {
            ...baseData,
            lineItems: Array.from({ length: 60 }, (_, i) => ({
                description: `Line item ${i + 1} — Key Grip Regular hours`,
                hours: 8,
                rate: 50,
                amount: 400,
            })),
            subtotal: 60 * 400,
            totalAmount: 60 * 400,
        };
        await expect((0, pdf_1.buildPdf)(manyItems)).rejects.toThrow(/too many line items/i);
    });
});
