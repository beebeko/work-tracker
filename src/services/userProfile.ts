import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UpdateUserProfileInput, UserProfile } from '../types/userProfile';

const COLLECTION = 'userProfiles';

function requireAuth(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  return uid;
}

function toProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid,
    name: data.name as string,
    email: data.email as string,
    address: data.address as string | undefined,
    phone: data.phone as string | undefined,
    updatedAt: data.updatedAt as UserProfile['updatedAt'],
  };
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const uid = requireAuth();
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return toProfile(snap.id, snap.data());
}

/** Creates or updates the profile (merge: true so missing optional fields are preserved). */
export async function upsertUserProfile(data: UpdateUserProfileInput): Promise<void> {
  const uid = requireAuth();
  await setDoc(
    doc(db, COLLECTION, uid),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
