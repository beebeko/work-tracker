import { describe, expect, it } from "vitest";

import { getSyncStatusLabel, resolveSyncStatus } from "../startupStatus";

describe("startup status", () => {
    it("returns null in json mode", () => {
        expect(
            resolveSyncStatus({
                firebaseMode: false,
                isOnline: true,
                isLoading: false,
                bootstrapError: null,
            }),
        ).toBeNull();
    });

    it("returns bootstrap-error when bootstrap failed", () => {
        expect(
            resolveSyncStatus({
                firebaseMode: true,
                isOnline: true,
                isLoading: false,
                bootstrapError: "bad config",
            }),
        ).toBe("bootstrap-error");
    });

    it("prefers offline over syncing", () => {
        expect(
            resolveSyncStatus({
                firebaseMode: true,
                isOnline: false,
                isLoading: true,
                bootstrapError: null,
            }),
        ).toBe("offline");
    });

    it("returns syncing when online and loading", () => {
        expect(
            resolveSyncStatus({
                firebaseMode: true,
                isOnline: true,
                isLoading: true,
                bootstrapError: null,
            }),
        ).toBe("syncing");
    });

    it("returns synced when online and idle", () => {
        expect(
            resolveSyncStatus({
                firebaseMode: true,
                isOnline: true,
                isLoading: false,
                bootstrapError: null,
            }),
        ).toBe("synced");
    });

    it("maps all status labels", () => {
        expect(getSyncStatusLabel("offline")).toBe("Offline");
        expect(getSyncStatusLabel("syncing")).toBe("Syncing");
        expect(getSyncStatusLabel("synced")).toBe("Synced");
        expect(getSyncStatusLabel("bootstrap-error")).toBe("Bootstrap Error");
    });
});
