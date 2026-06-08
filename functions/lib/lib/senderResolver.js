"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSenderToClient = resolveSenderToClient;
const admin_1 = require("./admin");
/**
 * Resolves a bare sender email address to a client.
 *
 * Matching order:
 * 1. Exact address match (patternType === 'address')
 * 2. Domain wildcard match (patternType === 'domain', pattern === the domain of the address)
 *
 * Returns null when no matching sender pattern is found.
 */
async function resolveSenderToClient(fromAddress) {
    const domain = fromAddress.split('@')[1] ?? '';
    // Query all sender documents that match the address or the domain.
    // We use two separate queries because Firestore does not support OR across fields.
    // TODO: add ownerUid filter before multi-user launch to prevent routing collisions
    // when two users register the same sender pattern.
    const [addressSnap, domainSnap] = await Promise.all([
        admin_1.db
            .collectionGroup('senders')
            .where('pattern', '==', fromAddress)
            .where('patternType', '==', 'address')
            .limit(1)
            .get(),
        admin_1.db
            .collectionGroup('senders')
            .where('pattern', '==', domain)
            .where('patternType', '==', 'domain')
            .limit(1)
            .get(),
    ]);
    const match = addressSnap.docs[0] ?? domainSnap.docs[0];
    if (!match)
        return null;
    const data = match.data();
    return {
        clientId: data.clientId,
        ownerUid: data.ownerUid,
    };
}
