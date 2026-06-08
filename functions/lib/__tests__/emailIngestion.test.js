"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const emailIngestion_1 = require("../lib/emailIngestion");
describe('emailIngestion', () => {
    describe('extractAddress', () => {
        it('extracts bare address from "Name <addr>" header', () => {
            expect((0, emailIngestion_1.extractAddress)('Scheduler <scheduler@acme.com>')).toBe('scheduler@acme.com');
        });
        it('returns lowercased trimmed address when header has no name', () => {
            expect((0, emailIngestion_1.extractAddress)('  Scheduler@Acme.com  ')).toBe('scheduler@acme.com');
        });
        it('lowercases addresses inside angle brackets', () => {
            expect((0, emailIngestion_1.extractAddress)('"Name" <SCHEDULER@ACME.COM>')).toBe('scheduler@acme.com');
        });
    });
    describe('SendGridAdapter', () => {
        const adapter = new emailIngestion_1.SendGridAdapter();
        it('parses a valid SendGrid Inbound Parse payload', () => {
            const result = adapter.parse({
                from: 'Scheduler <scheduler@acme.com>',
                subject: 'Call sheet',
                text: 'You are booked.',
            });
            expect(result.from).toBe('Scheduler <scheduler@acme.com>');
            expect(result.subject).toBe('Call sheet');
            expect(result.text).toBe('You are booked.');
            expect(typeof result.receivedAt).toBe('number');
        });
        it('falls back to html when text is missing', () => {
            const result = adapter.parse({
                from: 'a@b.com',
                html: '<p>hi</p>',
            });
            expect(result.text).toBe('<p>hi</p>');
        });
        it('throws when required fields are missing', () => {
            expect(() => adapter.parse({ subject: 'x' })).toThrow(/missing required fields/);
        });
    });
    describe('ResendAdapter', () => {
        const adapter = new emailIngestion_1.ResendAdapter();
        it('parses a Resend inbound payload with object-shaped from', () => {
            const result = adapter.parse({
                type: 'email.received',
                data: {
                    from: { name: 'Scheduler', address: 'scheduler@acme.com' },
                    to: ['parse@yourdomain.com'],
                    subject: 'Call sheet',
                    text: 'You are booked.',
                },
            });
            expect(result.from).toBe('Scheduler <scheduler@acme.com>');
            expect(result.subject).toBe('Call sheet');
            expect(result.text).toBe('You are booked.');
        });
        it('parses a Resend payload with string-shaped from', () => {
            const result = adapter.parse({
                type: 'email.received',
                data: {
                    from: 'Scheduler <scheduler@acme.com>',
                    subject: 'Call sheet',
                    text: 'Booked.',
                },
            });
            expect(result.from).toBe('Scheduler <scheduler@acme.com>');
        });
        it('accepts a flat payload (no envelope) for resilience', () => {
            const result = adapter.parse({
                from: 'a@b.com',
                subject: 's',
                text: 'body',
            });
            expect(result.from).toBe('a@b.com');
            expect(result.text).toBe('body');
        });
        it('falls back to html when text is missing', () => {
            const result = adapter.parse({
                data: {
                    from: 'a@b.com',
                    html: '<p>hi</p>',
                },
            });
            expect(result.text).toBe('<p>hi</p>');
        });
        it('handles from object with only address (no name)', () => {
            const result = adapter.parse({
                data: {
                    from: { address: 'scheduler@acme.com' },
                    text: 'body',
                },
            });
            expect(result.from).toBe('scheduler@acme.com');
        });
        it('handles from object with email field instead of address', () => {
            const result = adapter.parse({
                data: {
                    from: { email: 'scheduler@acme.com' },
                    text: 'body',
                },
            });
            expect(result.from).toBe('scheduler@acme.com');
        });
        it('throws when required fields are missing', () => {
            expect(() => adapter.parse({ data: { subject: 'x' } })).toThrow(/missing required fields/);
        });
        it('throws when from is an empty object', () => {
            expect(() => adapter.parse({ data: { from: {}, text: 'body' } })).toThrow(/missing required fields/);
        });
    });
});
