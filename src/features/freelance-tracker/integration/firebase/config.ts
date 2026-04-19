import type { FirebaseOptions } from "firebase/app";

const REQUIRED_ENV_KEYS = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
] as const;

type RequiredFirebaseEnvKey = (typeof REQUIRED_ENV_KEYS)[number];
type FirebaseEnv = Partial<Record<keyof ImportMetaEnv, string | undefined>>;

function readRequired(env: FirebaseEnv, key: RequiredFirebaseEnvKey): string {
    const rawValue = env[key];

    if (!rawValue || rawValue.trim().length === 0) {
        throw new Error(
            `Missing required Firebase environment variable: ${key}`,
        );
    }

    return rawValue.trim();
}

function readOptional(
    env: FirebaseEnv,
    key: keyof ImportMetaEnv,
): string | undefined {
    const rawValue = env[key];
    if (!rawValue) {
        return undefined;
    }

    const trimmed = rawValue.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function loadFirebaseConfig(
    env: FirebaseEnv = import.meta.env,
): FirebaseOptions {
    const missingKeys = REQUIRED_ENV_KEYS.filter((key) => {
        const value = env[key];
        return !value || value.trim().length === 0;
    });

    if (missingKeys.length > 0) {
        throw new Error(
            `Firebase configuration is incomplete. Missing environment variable(s): ${missingKeys.join(
                ", ",
            )}. Add these to your Vite env file (for example, .env.local).`,
        );
    }

    return {
        apiKey: readRequired(env, "VITE_FIREBASE_API_KEY"),
        authDomain: readRequired(env, "VITE_FIREBASE_AUTH_DOMAIN"),
        projectId: readRequired(env, "VITE_FIREBASE_PROJECT_ID"),
        appId: readRequired(env, "VITE_FIREBASE_APP_ID"),
        storageBucket: readOptional(env, "VITE_FIREBASE_STORAGE_BUCKET"),
        messagingSenderId: readOptional(
            env,
            "VITE_FIREBASE_MESSAGING_SENDER_ID",
        ),
        measurementId: readOptional(env, "VITE_FIREBASE_MEASUREMENT_ID"),
    };
}
