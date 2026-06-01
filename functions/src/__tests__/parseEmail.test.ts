// Mock firebase-admin before importing anything
const mockDb = {
  collection: jest.fn().mockReturnThis(),
  collectionGroup: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn(),
  add: jest.fn(),
} as any;

jest.mock('../lib/admin', () => ({ db: mockDb }));

// Mock onRequest so we can capture the handler
let capturedHandler: ((req: any, res: any) => Promise<void>) | null = null;

jest.mock('firebase-functions/v2/https', () => ({
  onRequest: jest.fn((optionsOrHandler: any, handler?: any) => {
    capturedHandler = typeof optionsOrHandler === 'function' ? optionsOrHandler : handler!;
    return capturedHandler;
  }),
}));

jest.mock('firebase-functions/params', () => ({
  defineSecret: jest.fn(() => ({ value: () => 'test-secret' })),
}));

jest.mock('firebase-functions/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../lib/openaiClient', () => ({
  getOpenAIClient: jest.fn(),
}));

jest.mock('../lib/senderResolver', () => ({
  resolveSenderToClient: jest.fn(),
}));

import { getOpenAIClient } from '../lib/openaiClient';
import { resolveSenderToClient } from '../lib/senderResolver';
// Import to trigger onRequest capture
import '../parseEmail';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(overrides: Partial<{ headers: object; body: object }> = {}) {
  return {
    headers: { 'x-parse-webhook-key': 'test-secret', ...overrides.headers },
    body: {
      from: 'Scheduler <scheduler@acme.com>',
      subject: 'Your call sheet',
      text: 'You are booked June 1st, 8am-6pm as Key Grip on Feature Film.',
      ...overrides.body,
    },
  };
}

function makeResponse() {
  const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
  return res;
}

function makeOpenAIMock(data: object) {
  return {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(data) } }],
        }),
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.collection.mockReturnValue(mockDb);
  mockDb.collectionGroup.mockReturnValue(mockDb);
  mockDb.where.mockReturnValue(mockDb);
  mockDb.limit.mockReturnValue(mockDb);
  mockDb.add.mockResolvedValue({ id: 'import-new' });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parseEmail', () => {
  describe('happy path — shift entry', () => {
    it('creates a pending import and responds 200', async () => {
      (resolveSenderToClient as jest.Mock).mockResolvedValue({
        clientId: 'client-1',
        ownerUid: 'user-1',
      });
      (getOpenAIClient as jest.Mock).mockReturnValue(
        makeOpenAIMock({
          date: '2026-06-01',
          entryType: 'shift',
          startTime: '08:00',
          endTime: '18:00',
          positionHint: 'Key Grip',
          gigHint: 'Feature Film',
          confidence: 0.95,
        }),
      );

      const req = makeRequest();
      const res = makeResponse();
      await capturedHandler!(req, res);

      expect(res.status).not.toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('OK');
      expect(mockDb.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUid: 'user-1',
          clientId: 'client-1',
          status: 'pending',
          extracted: expect.objectContaining({
            date: '2026-06-01',
            entryType: 'shift',
            confidence: 0.95,
          }),
        }),
      );
    });

    it('creates a pending import for a lump_sum email', async () => {
      (resolveSenderToClient as jest.Mock).mockResolvedValue({
        clientId: 'client-1',
        ownerUid: 'user-1',
      });
      (getOpenAIClient as jest.Mock).mockReturnValue(
        makeOpenAIMock({
          date: '2026-06-02',
          entryType: 'lump_sum',
          amount: 250,
          gigHint: 'Feature Film',
          confidence: 0.88,
        }),
      );

      const req = makeRequest({
        body: {
          from: 'scheduler@acme.com',
          subject: 'Kit rental',
          text: 'Box rental $250 on June 2nd.',
        },
      });
      const res = makeResponse();
      await capturedHandler!(req, res);

      expect(res.send).toHaveBeenCalledWith('OK');
      expect(mockDb.add).toHaveBeenCalledWith(
        expect.objectContaining({
          extracted: expect.objectContaining({ entryType: 'lump_sum', amount: 250 }),
        }),
      );
    });
  });

  describe('authentication', () => {
    it('returns 401 when webhook secret is missing', async () => {
      const req = makeRequest({ headers: { 'x-parse-webhook-key': undefined } });
      const res = makeResponse();
      await capturedHandler!(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockDb.add).not.toHaveBeenCalled();
    });

    it('returns 401 when webhook secret is wrong', async () => {
      const req = makeRequest({ headers: { 'x-parse-webhook-key': 'wrong-secret' } });
      const res = makeResponse();
      await capturedHandler!(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('sender resolution', () => {
    it('discards email silently (200) when sender is not tracked', async () => {
      (resolveSenderToClient as jest.Mock).mockResolvedValue(null);

      const req = makeRequest();
      const res = makeResponse();
      await capturedHandler!(req, res);

      expect(res.send).toHaveBeenCalledWith('OK');
      expect(mockDb.add).not.toHaveBeenCalled();
    });
  });

  describe('bad input', () => {
    it('returns 400 when email payload is missing required fields', async () => {
      // Send a raw request with no from or text — bypass makeRequest defaults
      const req = {
        headers: { 'x-parse-webhook-key': 'test-secret' },
        body: { subject: 'No from or text fields present' },
      };
      const res = makeResponse();
      await capturedHandler!(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockDb.add).not.toHaveBeenCalled();
    });
  });

  describe('mid-process failure', () => {
    it('returns 500 when OpenAI call fails', async () => {
      (resolveSenderToClient as jest.Mock).mockResolvedValue({
        clientId: 'client-1',
        ownerUid: 'user-1',
      });
      (getOpenAIClient as jest.Mock).mockReturnValue({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI timeout')),
          },
        },
      });

      const req = makeRequest();
      const res = makeResponse();
      await capturedHandler!(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockDb.add).not.toHaveBeenCalled();
    });

    it('returns 500 when OpenAI returns an invalid date', async () => {
      (resolveSenderToClient as jest.Mock).mockResolvedValue({
        clientId: 'client-1',
        ownerUid: 'user-1',
      });
      (getOpenAIClient as jest.Mock).mockReturnValue(
        makeOpenAIMock({ date: 'not-a-date', entryType: 'shift', confidence: 0.5 }),
      );

      const req = makeRequest();
      const res = makeResponse();
      await capturedHandler!(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('edge cases', () => {
    it('truncates raw email body to MAX_RAW_BYTES (10 KB)', async () => {
      (resolveSenderToClient as jest.Mock).mockResolvedValue({
        clientId: 'client-1',
        ownerUid: 'user-1',
      });
      (getOpenAIClient as jest.Mock).mockReturnValue(
        makeOpenAIMock({
          date: '2026-06-01',
          entryType: 'shift',
          startTime: '08:00',
          endTime: '18:00',
          confidence: 0.9,
        }),
      );

      const longBody = 'A'.repeat(20_000);
      const req = makeRequest({ body: { from: 'scheduler@acme.com', text: longBody } });
      const res = makeResponse();
      await capturedHandler!(req, res);

      const storedRaw: string = mockDb.add.mock.calls[0][0].rawEmail;
      expect(storedRaw.length).toBeLessThanOrEqual(10_240);
    });

    it('clamps confidence to [0, 1] even if OpenAI returns out-of-range value', async () => {
      (resolveSenderToClient as jest.Mock).mockResolvedValue({
        clientId: 'client-1',
        ownerUid: 'user-1',
      });
      (getOpenAIClient as jest.Mock).mockReturnValue(
        makeOpenAIMock({
          date: '2026-06-01',
          entryType: 'shift',
          confidence: 1.5,
        }),
      );

      const req = makeRequest();
      const res = makeResponse();
      await capturedHandler!(req, res);

      const stored = mockDb.add.mock.calls[0][0];
      expect(stored.extracted.confidence).toBe(1);
    });
  });
});
