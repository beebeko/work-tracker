import { db } from './admin';

export interface ResolvedClient {
  clientId: string;
  ownerUid: string;
}

/**
 * Resolves a bare sender email address to a client.
 *
 * Matching order:
 * 1. Exact address match (patternType === 'address')
 * 2. Domain wildcard match (patternType === 'domain', pattern === the domain of the address)
 *
 * Returns null when no matching sender pattern is found.
 */
export async function resolveSenderToClient(
  fromAddress: string,
): Promise<ResolvedClient | null> {
  const domain = fromAddress.split('@')[1] ?? '';

  // Query all sender documents that match the address or the domain.
  // We use two separate queries because Firestore does not support OR across fields.
  // TODO: add ownerUid filter before multi-user launch to prevent routing collisions
  // when two users register the same sender pattern.
  const [addressSnap, domainSnap] = await Promise.all([
    db
      .collectionGroup('senders')
      .where('pattern', '==', fromAddress)
      .where('patternType', '==', 'address')
      .limit(1)
      .get(),
    db
      .collectionGroup('senders')
      .where('pattern', '==', domain)
      .where('patternType', '==', 'domain')
      .limit(1)
      .get(),
  ]);

  const match = addressSnap.docs[0] ?? domainSnap.docs[0];
  if (!match) return null;

  const data = match.data();
  return {
    clientId: data.clientId as string,
    ownerUid: data.ownerUid as string,
  };
}
