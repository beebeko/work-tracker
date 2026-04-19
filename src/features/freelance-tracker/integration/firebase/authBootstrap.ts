import {
    onAuthStateChanged,
    signInAnonymously,
    type Auth,
    type Unsubscribe,
} from "firebase/auth";

import { getFirebaseAuth } from "./client";
import { withTimeout } from "./withTimeout";

export interface AuthStartupState {
    uid: string | null;
    isAuthenticated: boolean;
    isAnonymous: boolean;
}

function toAuthStartupState(auth: Auth): AuthStartupState {
    const user = auth.currentUser;

    return {
        uid: user?.uid ?? null,
        isAuthenticated: Boolean(user),
        isAnonymous: Boolean(user?.isAnonymous),
    };
}

export function getAuthStartupState(
    auth: Auth = getFirebaseAuth(),
): AuthStartupState {
    return toAuthStartupState(auth);
}

export function subscribeToAuthStartupState(
    onState: (state: AuthStartupState) => void,
    auth: Auth = getFirebaseAuth(),
): Unsubscribe {
    return onAuthStateChanged(auth, (user) => {
        onState({
            uid: user?.uid ?? null,
            isAuthenticated: Boolean(user),
            isAnonymous: Boolean(user?.isAnonymous),
        });
    });
}

export async function ensureAnonymousUser(
    auth: Auth = getFirebaseAuth(),
): Promise<string> {
    if (auth.currentUser?.uid) {
        return auth.currentUser.uid;
    }

    const credential = await withTimeout(signInAnonymously(auth), 10000, "signInAnonymously");
    const uid = credential.user?.uid;

    if (!uid) {
        throw new Error(
            "Anonymous sign-in completed without a valid user uid.",
        );
    }

    return uid;
}

export async function bootstrapAnonymousAuth(
    auth: Auth = getFirebaseAuth(),
): Promise<AuthStartupState> {
    await ensureAnonymousUser(auth);
    return toAuthStartupState(auth);
}
