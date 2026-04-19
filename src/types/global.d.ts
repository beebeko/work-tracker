/// <reference types="vite/client" />

declare module "*.css";
declare module "*.less";
declare module "*.scss";

interface ImportMetaEnv {
    readonly VITE_FIREBASE_API_KEY?: string;
    readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
    readonly VITE_FIREBASE_PROJECT_ID?: string;
    readonly VITE_FIREBASE_APP_ID?: string;
    readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
    readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
    readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
    readonly VITE_FREELANCE_DATA_ADAPTER?: string;
    readonly VITE_USE_FIREBASE_EMULATOR?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface Window {
    __FREELANCE_E2E_STARTUP__?: {
        forceFirebaseMode?: boolean;
        bootstrapOutcomes?: Array<"success" | "error">;
        bootstrapErrorMessage?: string;
        __bootstrapCallCount?: number;
        createOrganizationOutcomes?: Array<"success" | "error" | "timeout">;
        createOrganizationErrorMessage?: string;
        createOrganizationTimeoutMs?: number;
        __createOrganizationCallCount?: number;
    };
}
