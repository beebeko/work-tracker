import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

import { loadFirebaseConfig } from "./config";

let cachedApp: FirebaseApp | null = null;
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

const USE_EMULATOR = import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true";

export function getFirebaseApp(): FirebaseApp {
    if (cachedApp) {
        return cachedApp;
    }

    cachedApp =
        getApps().length > 0 ? getApp() : initializeApp(loadFirebaseConfig());
    return cachedApp;
}

export function getFirebaseAuth(app: FirebaseApp = getFirebaseApp()): Auth {
    const auth = getAuth(app);
    if (USE_EMULATOR && !authEmulatorConnected) {
        authEmulatorConnected = true;
        connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    }
    return auth;
}

export function getFirebaseFirestore(
    app: FirebaseApp = getFirebaseApp(),
): Firestore {
    const db = getFirestore(app);
    if (USE_EMULATOR && !firestoreEmulatorConnected) {
        firestoreEmulatorConnected = true;
        connectFirestoreEmulator(db, "localhost", 8080);
    }
    return db;
}

export function initializeEmulatorConnections(): void {
    getFirebaseAuth();
    getFirebaseFirestore();
}
