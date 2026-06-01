jest.mock('../admin', () => ({
  db: mockDb,
}));

const mockDb = {
  collectionGroup: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn(),
} as any;

import { resolveSenderToClient } from '../senderResolver';

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.collectionGroup.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.limit.mockReturnThis();
});

function makeSenderSnap(data: object) {
  return { docs: [{ data: () => data }] };
}

const emptySnap = { docs: [] };

describe('resolveSenderToClient', () => {
  describe('happy path', () => {
    it('resolves an exact address match', async () => {
      mockDb.get
        .mockResolvedValueOnce(makeSenderSnap({ clientId: 'client-1', ownerUid: 'user-1' }))
        .mockResolvedValueOnce(emptySnap);

      const result = await resolveSenderToClient('scheduler@acme.com');

      expect(result).toEqual({ clientId: 'client-1', ownerUid: 'user-1' });
    });

    it('resolves a domain wildcard match when no address match exists', async () => {
      mockDb.get
        .mockResolvedValueOnce(emptySnap)
        .mockResolvedValueOnce(makeSenderSnap({ clientId: 'client-2', ownerUid: 'user-1' }));

      const result = await resolveSenderToClient('anyone@acme.com');

      expect(result).toEqual({ clientId: 'client-2', ownerUid: 'user-1' });
    });

    it('prefers address match over domain match', async () => {
      mockDb.get
        .mockResolvedValueOnce(makeSenderSnap({ clientId: 'client-addr', ownerUid: 'user-1' }))
        .mockResolvedValueOnce(makeSenderSnap({ clientId: 'client-domain', ownerUid: 'user-1' }));

      const result = await resolveSenderToClient('scheduler@acme.com');

      expect(result!.clientId).toBe('client-addr');
    });
  });

  describe('error handling', () => {
    it('returns null when no sender matches', async () => {
      mockDb.get.mockResolvedValue(emptySnap);

      const result = await resolveSenderToClient('unknown@stranger.com');
      expect(result).toBeNull();
    });

    it('propagates Firestore errors', async () => {
      mockDb.get.mockRejectedValue(new Error('Firestore down'));
      await expect(resolveSenderToClient('scheduler@acme.com')).rejects.toThrow('Firestore down');
    });
  });

  describe('bad input', () => {
    it('returns null for an address with no domain part', async () => {
      mockDb.get.mockResolvedValue(emptySnap);

      const result = await resolveSenderToClient('nodomain');
      expect(result).toBeNull();
    });
  });
});
