import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
});

describe("data layer adapter selection", () => {
    it("uses JsonDataLayer by default", async () => {
        vi.stubEnv("VITE_FREELANCE_DATA_ADAPTER", "");

        const { getDataLayer } = await import("../index");
        const { JsonDataLayer } = await import("../adapters/json.adapter");

        expect(getDataLayer()).toBeInstanceOf(JsonDataLayer);
    });

    it("uses FirebaseDataLayer when explicitly configured", async () => {
        vi.stubEnv("VITE_FREELANCE_DATA_ADAPTER", "firebase");

        const firebaseInitialize = vi.fn().mockResolvedValue({
            success: true,
            data: undefined,
        });

        vi.doMock("../adapters/firebase.adapter", () => ({
            FirebaseDataLayer: class FirebaseDataLayerMock {
                entries = {};
                organizations = {};
                tags = {};
                positions = {};
                venues = {};
                rulesets = {};
                transaction = { transaction: vi.fn() };
                initialize = firebaseInitialize;
                dispose = vi.fn();
            },
        }));

        const { getDataLayer } = await import("../index");
        const instance = getDataLayer();

        expect(firebaseInitialize).toHaveBeenCalledTimes(1);
        expect(instance.constructor.name).toBe("FirebaseDataLayerMock");
    });

    it("falls back to JsonDataLayer for unknown adapter values", async () => {
        vi.stubEnv("VITE_FREELANCE_DATA_ADAPTER", "experimental");

        const { getDataLayer } = await import("../index");
        const { JsonDataLayer } = await import("../adapters/json.adapter");

        expect(getDataLayer()).toBeInstanceOf(JsonDataLayer);
    });

    it("logs actionable init errors when configured adapter fails to bootstrap", async () => {
        vi.stubEnv("VITE_FREELANCE_DATA_ADAPTER", "firebase");

        const initError = {
            type: "io",
            message:
                "Firebase adapter is enabled but bootstrap auth/config failed",
            operation: "initialize",
            attempted: "ensureAnonymousUser",
        } as const;

        const firebaseInitialize = vi.fn().mockResolvedValue({
            success: false,
            error: initError,
        });

        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
            return;
        });

        vi.doMock("../adapters/firebase.adapter", () => ({
            FirebaseDataLayer: class FirebaseDataLayerMock {
                entries = {};
                organizations = {};
                tags = {};
                positions = {};
                venues = {};
                rulesets = {};
                transaction = { transaction: vi.fn() };
                initialize = firebaseInitialize;
                dispose = vi.fn();
            },
        }));

        const { getDataLayer } = await import("../index");
        getDataLayer();
        await Promise.resolve();

        expect(firebaseInitialize).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(
            "Failed to initialize data layer. If you enabled Firebase via VITE_FREELANCE_DATA_ADAPTER=firebase, verify Firebase env vars and anonymous auth bootstrap are configured:",
            initError,
        );
    });
});
