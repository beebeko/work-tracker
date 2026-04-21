import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

const FIRESTORE_EMULATOR_HOST = "127.0.0.1";
const FIRESTORE_EMULATOR_PORT = 8080;
const RULES_TEST_PROJECT_ID = "work-tracker-rules-tests";

let testEnvironment: RulesTestEnvironment;

describe("firestore.rules guardrails", () => {
    beforeAll(async () => {
        testEnvironment = await initializeTestEnvironment({
            projectId: RULES_TEST_PROJECT_ID,
            firestore: {
                host: FIRESTORE_EMULATOR_HOST,
                port: FIRESTORE_EMULATOR_PORT,
                rules: readFileSync(
                    resolve(process.cwd(), "firestore.rules"),
                    "utf8",
                ),
            },
        });
    });

    afterEach(async () => {
        await testEnvironment.clearFirestore();
    });

    afterAll(async () => {
        await testEnvironment.cleanup();
    });

    it("allows authenticated users to access their own users/{uid}/... path", async () => {
        const db = testEnvironment.authenticatedContext("alice").firestore();
        const ownEntryRef = doc(db, "users/alice/entries/entry-1");

        await assertSucceeds(setDoc(ownEntryRef, { minutes: 120 }));
        await assertSucceeds(getDoc(ownEntryRef));
    });

    it("denies access when authenticated uid does not match path-scoped user id", async () => {
        const db = testEnvironment
            .authenticatedContext("session-user")
            .firestore();
        const mismatchedPathRef = doc(db, "users/alice/entries/entry-mismatch");

        await assertFails(setDoc(mismatchedPathRef, { minutes: 10 }));
        await assertFails(getDoc(mismatchedPathRef));
    });

    it("denies cross-user and non-users document paths", async () => {
        const db = testEnvironment.authenticatedContext("alice").firestore();
        const unauthenticatedDb = testEnvironment
            .unauthenticatedContext()
            .firestore();
        const otherUserEntryRef = doc(db, "users/bob/entries/entry-2");
        const nonUsersPathRef = doc(db, "organizations/org-1");
        const unauthenticatedOwnPathRef = doc(
            unauthenticatedDb,
            "users/alice/entries/entry-3",
        );

        await assertFails(getDoc(otherUserEntryRef));
        await assertFails(setDoc(otherUserEntryRef, { minutes: 60 }));
        await assertFails(getDoc(nonUsersPathRef));
        await assertFails(setDoc(nonUsersPathRef, { name: "Nope" }));
        await assertFails(getDoc(unauthenticatedOwnPathRef));
        await assertFails(setDoc(unauthenticatedOwnPathRef, { minutes: 45 }));
    });
});
