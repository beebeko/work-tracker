import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Auth } from "firebase/auth";

const mocks = vi.hoisted(() => ({
    signInAnonymously: vi.fn(),
    onAuthStateChanged: vi.fn(),
}));

vi.mock("firebase/auth", async (importOriginal) => {
    const actual = await importOriginal<typeof import("firebase/auth")>();
    return {
        ...actual,
        signInAnonymously: mocks.signInAnonymously,
        onAuthStateChanged: mocks.onAuthStateChanged,
    };
});

import {
    bootstrapAnonymousAuth,
    ensureAnonymousUser,
    getAuthStartupState,
    subscribeToAuthStartupState,
} from "../authBootstrap";

function createAuth(currentUser: Auth["currentUser"]): Auth {
    return { currentUser } as Auth;
}

describe("auth bootstrap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns existing uid when a user is already present", async () => {
        const auth = createAuth({
            uid: "existing-user",
            isAnonymous: true,
        } as Auth["currentUser"]);

        const uid = await ensureAnonymousUser(auth);

        expect(uid).toBe("existing-user");
        expect(mocks.signInAnonymously).not.toHaveBeenCalled();
    });

    it("signs in anonymously when no user exists", async () => {
        const auth = createAuth(null);
        mocks.signInAnonymously.mockResolvedValue({
            user: { uid: "anon-uid" },
        });

        const uid = await ensureAnonymousUser(auth);

        expect(uid).toBe("anon-uid");
        expect(mocks.signInAnonymously).toHaveBeenCalledWith(auth);
    });

    it("throws when anonymous sign-in returns no uid", async () => {
        const auth = createAuth(null);
        mocks.signInAnonymously.mockResolvedValue({ user: null });

        await expect(ensureAnonymousUser(auth)).rejects.toThrowError(
            "Anonymous sign-in completed without a valid user uid.",
        );
    });

    it("returns a stable startup snapshot", () => {
        const auth = createAuth({
            uid: "snap",
            isAnonymous: false,
        } as Auth["currentUser"]);

        expect(getAuthStartupState(auth)).toEqual({
            uid: "snap",
            isAuthenticated: true,
            isAnonymous: false,
        });
    });

    it("subscribes to auth state changes with normalized snapshot output", () => {
        const auth = createAuth(null);
        const unsubscribe = vi.fn();

        mocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
            callback({ uid: "listener", isAnonymous: true });
            return unsubscribe;
        });

        const onState = vi.fn();
        const dispose = subscribeToAuthStartupState(onState, auth);

        expect(mocks.onAuthStateChanged).toHaveBeenCalledWith(
            auth,
            expect.any(Function),
        );
        expect(onState).toHaveBeenCalledWith({
            uid: "listener",
            isAuthenticated: true,
            isAnonymous: true,
        });

        dispose();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("bootstraps auth and returns current startup snapshot", async () => {
        const auth = createAuth({
            uid: "boot",
            isAnonymous: true,
        } as Auth["currentUser"]);

        const state = await bootstrapAnonymousAuth(auth);

        expect(state).toEqual({
            uid: "boot",
            isAuthenticated: true,
            isAnonymous: true,
        });
    });
});
