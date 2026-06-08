import { Timestamp } from 'firebase/firestore';

export type SenderPatternType = 'address' | 'domain';

/**
 * A sender address or domain pattern associated with a client.
 * Emails whose From address matches a pattern are routed to that client for parsing.
 *
 * address pattern: exact match, e.g. "scheduler@company.com"
 * domain  pattern: any address at the domain, e.g. "company.com" matches "*@company.com"
 */
export interface ClientSender {
  id: string;
  ownerUid: string;
  clientId: string;
  /** The address or bare domain to match against */
  pattern: string;
  patternType: SenderPatternType;
  createdAt: Timestamp;
}

export type CreateClientSenderInput = Omit<ClientSender, 'id' | 'ownerUid' | 'createdAt'>;
