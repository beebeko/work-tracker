import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreState = vi.hoisted(() => ({
    docs: new Map<string, Record<string, unknown>>(),
    failSetDocOnPath: null as string | null,
}));

const firebaseBoundaryMocks = vi.hoisted(() => ({
    ensureAnonymousUser: vi.fn(),
    getFirebaseFirestore: vi.fn(),
}));

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function listCollectionDocs(
    collectionPath: string,
): Array<{ id: string; path: string; data: Record<string, unknown> }> {
    const prefix = `${collectionPath}/`;

    return [...firestoreState.docs.entries()]
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, value]) => {
            const id = path.slice(prefix.length);
            return { id, path, data: clone(value) };
        });
}

function attachLocalStorage() {
    const localStorage = window.localStorage;
    localStorage.clear();
    Object.defineProperty(globalThis, "localStorage", {
        value: localStorage,
        configurable: true,
    });
    return localStorage;
}

vi.mock("../../integration/firebase/authBootstrap", () => ({
    ensureAnonymousUser: firebaseBoundaryMocks.ensureAnonymousUser,
}));

vi.mock("../../integration/firebase/client", () => ({
    getFirebaseFirestore: firebaseBoundaryMocks.getFirebaseFirestore,
}));

vi.mock("firebase/firestore", () => ({
    collection: (_db: unknown, ...pathParts: string[]) => ({
        kind: "collection",
        path: pathParts.join("/"),
    }),
    doc: (_db: unknown, ...pathParts: string[]) => ({
        kind: "doc",
        path: pathParts.join("/"),
    }),
    where: (field: string, op: string, value: unknown) => ({
        kind: "where",
        field,
        op,
        value,
    }),
    orderBy: (field: string, direction: "asc" | "desc" = "asc") => ({
        kind: "orderBy",
        field,
        direction,
    }),
    limit: (value: number) => ({ kind: "limit", value }),
    query: (
        collectionRef: { path: string },
        ...constraints: Array<Record<string, unknown>>
    ) => ({
        kind: "query",
        collectionPath: collectionRef.path,
        constraints,
    }),
    getFirestore: vi.fn(),
    writeBatch: vi.fn(() => {
        const staged: Array<
            | { type: "set"; path: string; data: Record<string, unknown> }
            | { type: "delete"; path: string }
        > = [];

        return {
            set: (docRef: { path: string }, data: Record<string, unknown>) => {
                staged.push({
                    type: "set",
                    path: docRef.path,
                    data: clone(data),
                });
            },
            delete: (docRef: { path: string }) => {
                staged.push({ type: "delete", path: docRef.path });
            },
            commit: async () => {
                if (firestoreState.failSetDocOnPath) {
                    const hasFailurePath = staged.some((operation) =>
                        operation.path.includes(
                            firestoreState.failSetDocOnPath ?? "",
                        ),
                    );
                    if (hasFailurePath) {
                        throw new Error(
                            `Simulated batch commit failure for ${firestoreState.failSetDocOnPath}`,
                        );
                    }
                }

                for (const operation of staged) {
                    if (operation.type === "set") {
                        firestoreState.docs.set(
                            operation.path,
                            clone(operation.data),
                        );
                    } else {
                        firestoreState.docs.delete(operation.path);
                    }
                }
            },
        };
    }),
    setDoc: vi.fn(
        async (docRef: { path: string }, data: Record<string, unknown>) => {
            if (
                firestoreState.failSetDocOnPath &&
                docRef.path.includes(firestoreState.failSetDocOnPath)
            ) {
                throw new Error(`Simulated setDoc failure for ${docRef.path}`);
            }
            firestoreState.docs.set(docRef.path, clone(data));
        },
    ),
    getDoc: vi.fn(async (docRef: { path: string }) => {
        const value = firestoreState.docs.get(docRef.path);
        return {
            id: docRef.path.split("/").at(-1),
            exists: () => value !== undefined,
            data: () => (value ? clone(value) : undefined),
        };
    }),
    deleteDoc: vi.fn(async (docRef: { path: string }) => {
        firestoreState.docs.delete(docRef.path);
    }),
    getDocs: vi.fn(
        async (input: {
            kind: string;
            path?: string;
            collectionPath?: string;
            constraints?: Array<Record<string, unknown>>;
        }) => {
            const collectionPath =
                input.kind === "query" ? input.collectionPath : input.path;
            const constraints =
                input.kind === "query" ? (input.constraints ?? []) : [];

            let rows = listCollectionDocs(collectionPath ?? "");

            for (const constraint of constraints) {
                if (!isObject(constraint) || constraint.kind !== "where") {
                    continue;
                }

                const field = String(constraint.field);
                const op = String(constraint.op);
                const expected = constraint.value;

                rows = rows.filter((row) => {
                    const actual = row.data[field];
                    if (op === "==") return actual === expected;
                    if (op === ">=")
                        return String(actual ?? "") >= String(expected ?? "");
                    if (op === "<=")
                        return String(actual ?? "") <= String(expected ?? "");
                    return true;
                });
            }

            const orderByConstraint = constraints.find(
                (constraint) =>
                    isObject(constraint) && constraint.kind === "orderBy",
            );
            if (isObject(orderByConstraint)) {
                const field = String(orderByConstraint.field);
                const direction =
                    orderByConstraint.direction === "desc" ? "desc" : "asc";
                rows = rows.sort((left, right) => {
                    const a = String(left.data[field] ?? "");
                    const b = String(right.data[field] ?? "");
                    const cmp = a.localeCompare(b);
                    return direction === "desc" ? -cmp : cmp;
                });
            }

            const limitConstraint = constraints.find(
                (constraint) =>
                    isObject(constraint) && constraint.kind === "limit",
            );
            if (
                isObject(limitConstraint) &&
                typeof limitConstraint.value === "number"
            ) {
                rows = rows.slice(0, limitConstraint.value);
            }

            return {
                docs: rows.map((row) => ({
                    id: row.id,
                    exists: () => true,
                    data: () => clone(row.data),
                })),
            };
        },
    ),
}));

import { FirebaseDataLayer } from "../adapters/firebase.adapter";

describe("FirebaseDataLayer", () => {
    const localStorageKeys = {
        entries: "freelance-tracker:entries",
        organizations: "freelance-tracker:organizations",
        tags: "freelance-tracker:tags",
        positions: "freelance-tracker:positions",
        venues: "freelance-tracker:venues",
        rulesets: "freelance-tracker:rulesets",
        sentinel: "freelance-tracker:firebase-migrated:v1:uid-test",
    } as const;

    function seedValidLocalPayload(storage: Storage) {
        storage.setItem(
            localStorageKeys.organizations,
            JSON.stringify([
                {
                    organizationId: "org-migrate0001",
                    name: "Local Org",
                    payPeriodStartDay: 1,
                    createdAt: "2026-04-10T10:00:00.000Z",
                },
            ]),
        );

        storage.setItem(
            localStorageKeys.entries,
            JSON.stringify([
                {
                    entryId: "entry-migrate0001",
                    organizationId: "org-migrate0001",
                    date: "2026-04-10",
                    startTime: "09:00",
                    endTime: "11:00",
                    position: "Audio",
                    rate: 30,
                    event: "Show",
                    tags: ["live"],
                    notes: "load-in",
                    mealPenaltyCount: 1,
                    createdAt: "2026-04-10T10:00:00.000Z",
                    updatedAt: "2026-04-10T10:00:00.000Z",
                },
            ]),
        );

        storage.setItem(
            localStorageKeys.tags,
            JSON.stringify([
                {
                    tag: "live",
                    count: 2,
                    lastUsedAt: "2026-04-10T10:00:00.000Z",
                },
            ]),
        );

        storage.setItem(
            localStorageKeys.positions,
            JSON.stringify([
                {
                    organizationId: "org-migrate0001",
                    position: "Audio",
                    count: 2,
                    lastUsedAt: "2026-04-10T10:00:00.000Z",
                },
            ]),
        );

        storage.setItem(
            localStorageKeys.venues,
            JSON.stringify([
                {
                    organizationId: "org-migrate0001",
                    venueName: "Main Stage",
                    count: 2,
                    lastUsedAt: "2026-04-10T10:00:00.000Z",
                },
            ]),
        );

        storage.setItem(
            localStorageKeys.rulesets,
            JSON.stringify([
                {
                    rulesetId: "ruleset-migrate0001",
                    organizationId: "org-migrate0001",
                    effectiveDate: "2026-04-01",
                    createdAt: "2026-04-01T00:00:00.000Z",
                    rules: [
                        {
                            ruleId: "rule-migrate-1",
                            type: "meal-penalty",
                            penaltyAmount: 25,
                        },
                    ],
                },
            ]),
        );
    }

    beforeEach(() => {
        attachLocalStorage();
        firestoreState.docs.clear();
        firestoreState.failSetDocOnPath = null;
        vi.clearAllMocks();
        firebaseBoundaryMocks.ensureAnonymousUser.mockResolvedValue("uid-test");
        firebaseBoundaryMocks.getFirebaseFirestore.mockReturnValue({});
    });

    it("returns actionable initialize error when Firebase auth/config bootstrap is missing", async () => {
        firebaseBoundaryMocks.ensureAnonymousUser.mockRejectedValue(
            new Error(
                "Missing required Firebase environment variable: VITE_FIREBASE_API_KEY",
            ),
        );

        const dal = new FirebaseDataLayer();
        const init = await dal.initialize();

        expect(init.success).toBe(false);
        if (init.success) return;

        expect(init.error.type).toBe("io");
        if (init.error.type !== "io") return;
        expect(init.error.message).toContain(
            "VITE_FREELANCE_DATA_ADAPTER=firebase",
        );
        expect(init.error.message).toContain("VITE_FIREBASE_API_KEY");
    });

    it("migrates local JsonDataLayer payload into uid-scoped Firestore docs on first initialize", async () => {
        const storage = attachLocalStorage();
        seedValidLocalPayload(storage);

        const dal = new FirebaseDataLayer();
        const init = await dal.initialize();

        expect(init.success).toBe(true);
        expect(
            firestoreState.docs.has(
                "users/uid-test/organizations/org-migrate0001",
            ),
        ).toBe(true);
        expect(
            firestoreState.docs.has("users/uid-test/entries/entry-migrate0001"),
        ).toBe(true);
        expect(firestoreState.docs.has("users/uid-test/tags/live")).toBe(true);
        expect(
            firestoreState.docs.has(
                "users/uid-test/positions/org-migrate0001__audio",
            ),
        ).toBe(true);
        expect(
            firestoreState.docs.has(
                "users/uid-test/venues/org-migrate0001__main%20stage",
            ),
        ).toBe(true);
        expect(
            firestoreState.docs.has(
                "users/uid-test/rulesets/ruleset-migrate0001",
            ),
        ).toBe(true);

        const sentinel = storage.getItem(localStorageKeys.sentinel);
        expect(sentinel).toBeTruthy();
        expect(String(sentinel)).toContain('"version":1');
    });

    it("skips migration writes when sentinel already exists", async () => {
        const storage = attachLocalStorage();
        seedValidLocalPayload(storage);
        storage.setItem(
            localStorageKeys.sentinel,
            JSON.stringify({ version: 1, migratedAt: "2026-04-16T00:00:00Z" }),
        );

        const dal = new FirebaseDataLayer();
        const init = await dal.initialize();

        expect(init.success).toBe(true);
        expect(firestoreState.docs.size).toBe(0);
    });

    it("returns validation error when local migration payload is malformed", async () => {
        const storage = attachLocalStorage();
        storage.setItem(localStorageKeys.entries, "{not-json");

        const dal = new FirebaseDataLayer();
        const init = await dal.initialize();

        expect(init.success).toBe(false);
        if (init.success) return;

        expect(init.error.type).toBe("validation");
        if (init.error.type !== "validation") return;
        expect(init.error.field).toBe(localStorageKeys.entries);
        expect(init.error.message).toContain("not valid JSON");
    });

    it("returns io error with write target details when migration write fails", async () => {
        const storage = attachLocalStorage();
        seedValidLocalPayload(storage);
        firestoreState.failSetDocOnPath = "users/uid-test/entries/";

        const dal = new FirebaseDataLayer();
        const init = await dal.initialize();

        expect(init.success).toBe(false);
        if (init.success) return;

        expect(init.error.type).toBe("io");
        if (init.error.type !== "io") return;
        expect(init.error.message).toContain("users/uid-test/entries/");
        expect(storage.getItem(localStorageKeys.sentinel)).toBeNull();
    });

    it("creates and lists organizations under users/{uid}/organizations", async () => {
        const dal = new FirebaseDataLayer();

        const created = await dal.organizations.create({
            name: "Firestore Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            notes: "# Venue notes",
        });

        expect(created.success).toBe(true);
        if (!created.success) return;

        const expectedPath = `users/uid-test/organizations/${created.data.organizationId}`;
        expect(firestoreState.docs.has(expectedPath)).toBe(true);

        const listed = await dal.organizations.list();
        expect(listed.success).toBe(true);
        if (!listed.success) return;
        expect(listed.data).toHaveLength(1);
        expect(listed.data[0].name).toBe("Firestore Org");
        expect(listed.data[0].notes).toBe("# Venue notes");
    });

    it("migrates legacy organizations with normalized defaults for optional fields", async () => {
        const storage = attachLocalStorage();
        seedValidLocalPayload(storage);

        const dal = new FirebaseDataLayer();
        const init = await dal.initialize();

        expect(init.success).toBe(true);

        const organizationDoc = firestoreState.docs.get(
            "users/uid-test/organizations/org-migrate0001",
        ) as Record<string, unknown> | undefined;

        expect(organizationDoc).toMatchObject({
            timezone: "UTC",
            workweekStartDay: 1,
            notes: null,
            venues: [],
            positions: [],
        });
    });

    it("round-trips entries and maps stored date field back to dateWorked", async () => {
        const dal = new FirebaseDataLayer();
        const org = await dal.organizations.create({
            name: "Entry Org",
            payPeriodStartDay: 2,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        if (!org.success) throw new Error("organization create failed");

        const created = await dal.entries.create({
            organizationId: org.data.organizationId,
            date: "2026-04-15",
            startTime: "09:00",
            endTime: "11:00",
            position: "Audio",
            rate: 42,
            event: "Show",
            tags: ["live"],
            notes: "setup",
            mealPenaltyCount: 0,
        } as any);

        expect(created.success).toBe(true);
        if (!created.success) return;

        const byId = await dal.entries.getById(created.data.entryId);
        expect(byId.success).toBe(true);
        if (!byId.success) return;

        expect(byId.data.dateWorked).toBe("2026-04-15");
        expect(byId.data.event).toBe("Show");

        const listed = await dal.entries.list({
            organizationId: org.data.organizationId,
            startDate: "2026-04-01",
            endDate: "2026-04-30",
        });

        expect(listed.success).toBe(true);
        if (!listed.success) return;
        expect(listed.data).toHaveLength(1);
        expect(listed.data[0].entryId).toBe(created.data.entryId);
    });

    it("records tags case-insensitively with count increments", async () => {
        const dal = new FirebaseDataLayer();

        const first = await dal.tags.record("Audio");
        const second = await dal.tags.record("audio");

        expect(first.success).toBe(true);
        expect(second.success).toBe(true);

        const tags = await dal.tags.getAll();
        expect(tags.success).toBe(true);
        if (!tags.success) return;

        expect(tags.data).toHaveLength(1);
        expect(tags.data[0].count).toBe(2);
    });

    it("commits grouped transaction writes through atomic batch semantics", async () => {
        const dal = new FirebaseDataLayer();
        const org = await dal.organizations.create({
            name: "Tx Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        if (!org.success) throw new Error("organization create failed");

        const txResult = await dal.transaction.transaction(async (tx) => {
            await tx.tags.record("tx-tag");
            await tx.positions.record(org.data.organizationId, "Mixer");
            await tx.entries.create({
                organizationId: org.data.organizationId,
                dateWorked: "2026-04-16",
                startTime: "09:00",
                endTime: "10:00",
                position: "Mixer",
                rate: 40,
                event: "TX",
                tags: ["tx-tag"],
                notes: "tx",
                mealPenaltyCount: 0,
            });
            return { success: true, data: "done" };
        });

        expect(txResult.success).toBe(true);

        const tags = await dal.tags.getAll();
        expect(tags.success).toBe(true);
        if (!tags.success) return;
        expect(tags.data).toHaveLength(1);
        expect(tags.data[0].tag).toBe("tx-tag");

        const positions = await dal.positions.getByOrg(org.data.organizationId);
        expect(positions.success).toBe(true);
        if (!positions.success) return;
        expect(positions.data).toHaveLength(1);

        const entries = await dal.entries.list({
            organizationId: org.data.organizationId,
            startDate: "2026-04-01",
            endDate: "2026-04-30",
        });
        expect(entries.success).toBe(true);
        if (!entries.success) return;
        expect(entries.data).toHaveLength(1);
    });

    it("returns explicit transaction error when rollback is requested and persists no staged writes", async () => {
        const dal = new FirebaseDataLayer();

        const txResult = await dal.transaction.transaction(async (tx) => {
            await tx.tags.record("tx-tag");
            tx.rollback("test forced rollback");
            return { success: true, data: "done" };
        });

        expect(txResult.success).toBe(false);
        if (txResult.success) return;

        expect(txResult.error.type).toBe("transaction");
        if (txResult.error.type !== "transaction") return;
        expect(txResult.error.message).toContain("rollback requested");

        const tags = await dal.tags.getAll();
        expect(tags.success).toBe(true);
        if (!tags.success) return;

        expect(tags.data).toHaveLength(0);
    });

    it("returns structured error for unsupported transaction query flows", async () => {
        const dal = new FirebaseDataLayer();
        const org = await dal.organizations.create({
            name: "Unsupported Flow Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        if (!org.success) throw new Error("organization create failed");

        const txResult = await dal.transaction.transaction(async (tx) => {
            await tx.entries.list({
                organizationId: org.data.organizationId,
                startDate: "2026-04-01",
                endDate: "2026-04-30",
            });
            return { success: true, data: "done" };
        });

        expect(txResult.success).toBe(false);
        if (txResult.success) return;
        expect(txResult.error.type).toBe("transaction");
        if (txResult.error.type !== "transaction") return;
        expect(txResult.error.attempted).toContain("entries.list");
    });

    it("does not commit partial writes when atomic batch commit fails", async () => {
        const dal = new FirebaseDataLayer();
        const org = await dal.organizations.create({
            name: "Batch Failure Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
        });
        if (!org.success) throw new Error("organization create failed");

        firestoreState.failSetDocOnPath = "users/uid-test/positions/";

        const txResult = await dal.transaction.transaction(async (tx) => {
            await tx.tags.record("failure-tag");
            await tx.positions.record(
                org.data.organizationId,
                "Failure Position",
            );
            return { success: true, data: "done" };
        });

        expect(txResult.success).toBe(false);
        if (txResult.success) return;
        expect(txResult.error.type).toBe("transaction");

        const tags = await dal.tags.getAll();
        expect(tags.success).toBe(true);
        if (!tags.success) return;
        expect(tags.data).toHaveLength(0);

        const positions = await dal.positions.getByOrg(org.data.organizationId);
        expect(positions.success).toBe(true);
        if (!positions.success) return;
        expect(positions.data).toHaveLength(0);
    });
});
