import { describe, expect, it } from "vitest";

import { loadFirebaseConfig } from "../config";

describe("loadFirebaseConfig", () => {
    it("returns firebase options when required env vars are present", () => {
        const config = loadFirebaseConfig({
            VITE_FIREBASE_API_KEY: " api-key ",
            VITE_FIREBASE_AUTH_DOMAIN: " auth.example.com ",
            VITE_FIREBASE_PROJECT_ID: " project-id ",
            VITE_FIREBASE_APP_ID: " app-id ",
            VITE_FIREBASE_STORAGE_BUCKET: " bucket ",
            VITE_FIREBASE_MESSAGING_SENDER_ID: " sender ",
            VITE_FIREBASE_MEASUREMENT_ID: " measure ",
        });

        expect(config).toEqual({
            apiKey: "api-key",
            authDomain: "auth.example.com",
            projectId: "project-id",
            appId: "app-id",
            storageBucket: "bucket",
            messagingSenderId: "sender",
            measurementId: "measure",
        });
    });

    it("throws a helpful error listing all missing required vars", () => {
        expect(() =>
            loadFirebaseConfig({
                VITE_FIREBASE_API_KEY: "api-key",
                VITE_FIREBASE_AUTH_DOMAIN: "",
                VITE_FIREBASE_PROJECT_ID: "",
                VITE_FIREBASE_APP_ID: "app-id",
            }),
        ).toThrowError(
            "Firebase configuration is incomplete. Missing environment variable(s): VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID. Add these to your Vite env file (for example, .env.local).",
        );
    });
});
