import * as admin from 'firebase-admin';

// Initialize once at module load
if (!admin.apps.length) {
  admin.initializeApp();
}

export { admin };
export const db = admin.firestore();
export const storage = admin.storage();
