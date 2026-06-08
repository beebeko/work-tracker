import { auth } from '../lib/firebase';

/**
 * Asserts the user is authenticated and returns their uid.
 * Throws if called while unauthenticated.
 */
export function requireAuth(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}
