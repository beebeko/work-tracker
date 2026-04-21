import { v4 as uuidv4 } from "uuid";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    setDoc,
    writeBatch,
    where,
    type Firestore,
} from "firebase/firestore";

import type {
    DalError,
    CreateRulesetInput,
    CreateOrganizationInput,
    Entry,
    Id,
    Organization,
    PositionHistory,
    Result,
    Ruleset,
    TagHistory,
    VenueHistory,
} from "../../contracts/types";
import { err, ok } from "../../contracts/types";
import { ensureAnonymousUser } from "../../integration/firebase/authBootstrap";
import { getFirebaseFirestore } from "../../integration/firebase/client";
import { withTimeout } from "../../integration/firebase/withTimeout";
import type {
    IDataLayer,
    IEntryRepository,
    IOrganizationRepository,
    IPositionHistoryRepository,
    IRulesetRepository,
    ITagHistoryRepository,
    ITransactionContext,
    ITransactionManager,
    IVenueHistoryRepository,
} from "../dal";
import entrySchema from "../../../../../data/schema/entry.schema.json";
import organizationSchema from "../../../../../data/schema/organization.schema.json";
import positionHistorySchema from "../../../../../data/schema/position-history.schema.json";
import rulesetSchema from "../../../../../data/schema/ruleset.schema.json";
import tagHistorySchema from "../../../../../data/schema/tag-history.schema.json";
import venueHistorySchema from "../../../../../data/schema/venue-history.schema.json";

const COLLECTIONS = {
    entries: "entries",
    organizations: "organizations",
    tags: "tags",
    positions: "positions",
    venues: "venues",
    rulesets: "rulesets",
} as const;

const LOCAL_STORAGE_PREFIX = "freelance-tracker";
const LOCAL_ENTRIES_KEY = `${LOCAL_STORAGE_PREFIX}:entries`;
const LOCAL_ORGANIZATIONS_KEY = `${LOCAL_STORAGE_PREFIX}:organizations`;
const LOCAL_TAGS_KEY = `${LOCAL_STORAGE_PREFIX}:tags`;
const LOCAL_POSITIONS_KEY = `${LOCAL_STORAGE_PREFIX}:positions`;
const LOCAL_VENUES_KEY = `${LOCAL_STORAGE_PREFIX}:venues`;
const LOCAL_RULESETS_KEY = `${LOCAL_STORAGE_PREFIX}:rulesets`;
const FIREBASE_MIGRATION_VERSION = 1;

const ajv = new Ajv();
addFormats(ajv);
const validateEntry = ajv.compile(entrySchema);
const validateOrganization = ajv.compile(organizationSchema);
const validateTag = ajv.compile(tagHistorySchema);
const validatePosition = ajv.compile(positionHistorySchema);
const validateVenue = ajv.compile(venueHistorySchema);
const validateRuleset = ajv.compile(rulesetSchema);

type EntryCreateInput = Omit<Entry, "entryId" | "createdAt" | "updatedAt"> & {
    date?: string;
};

type StoredEntry = Omit<Entry, "dateWorked" | "event" | "notes"> & {
    date: string;
    event: string;
    notes: string;
};

type FirebaseScope = {
    db: Firestore;
    uid: string;
};

type LocalMigrationPayload = {
    entries: StoredEntry[];
    organizations: Organization[];
    tags: TagHistory[];
    positions: PositionHistory[];
    venues: VenueHistory[];
    rulesets: Ruleset[];
};

const genId = (prefix: string): Id =>
    `${prefix}-${uuidv4().replace(/-/g, "")}` as Id;

function normalizeKey(input: string): string {
    return encodeURIComponent(input.trim().toLowerCase());
}

function nowIso(previous?: string): string {
    const now = new Date();

    if (previous) {
        const previousMillis = new Date(previous).getTime();
        if (!Number.isNaN(previousMillis) && now.getTime() <= previousMillis) {
            return new Date(previousMillis + 1).toISOString();
        }
    }

    return now.toISOString();
}

function toStoredEntry(entry: EntryCreateInput, now: string): StoredEntry {
    const rawDate = entry.dateWorked ?? entry.date;

    const stored: StoredEntry = {
        entryId: genId("entry"),
        organizationId: entry.organizationId,
        date: rawDate ?? "",
        startTime: entry.startTime,
        endTime: entry.endTime,
        venue: entry.venue ?? "",
        position: entry.position,
        rate: entry.rate ?? null,
        event: entry.event ?? "",
        tags: entry.tags ?? [],
        notes: entry.notes ?? "",
        mealPenaltyCount: entry.mealPenaltyCount ?? 0,
        createdAt: now,
        updatedAt: now,
    };

    if (entry.paymentMode !== undefined) {
        stored.paymentMode = entry.paymentMode;
    }

    if (entry.flatFeeAmount !== undefined) {
        stored.flatFeeAmount = entry.flatFeeAmount;
    }

    return stored;
}

function toDomainEntry(stored: StoredEntry): Entry {
    const domainEntry: Entry = {
        entryId: stored.entryId,
        organizationId: stored.organizationId,
        dateWorked: stored.date,
        startTime: stored.startTime,
        endTime: stored.endTime,
        venue: stored.venue || null,
        position: stored.position,
        rate: stored.rate,
        event: stored.event || null,
        tags: stored.tags,
        notes: stored.notes || null,
        mealPenaltyCount: stored.mealPenaltyCount ?? 0,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
    };

    if (stored.paymentMode !== undefined) {
        domainEntry.paymentMode = stored.paymentMode;
    }

    if (stored.flatFeeAmount !== undefined) {
        domainEntry.flatFeeAmount = stored.flatFeeAmount;
    }

    return domainEntry;
}

function notFound(entityType: string, id: Id): Result<never> {
    return err({ type: "notFound", entityType, id });
}

function ioError(action: string, error: unknown): DalError {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
        type: "io",
        message: `Firebase ${action} failed: ${message}`,
        cause: error instanceof Error ? error : undefined,
    };
}

function getStorage(): Storage | null {
    return globalThis.window?.localStorage ?? globalThis.localStorage ?? null;
}

function normalizeStoredEntry(stored: StoredEntry): StoredEntry {
    return {
        ...stored,
        venue: stored.venue ?? "",
        event: stored.event ?? "",
        notes: stored.notes ?? "",
    };
}

function normalizeStoredOrganization(organization: Organization): Organization {
    return {
        ...organization,
        timezone:
            typeof organization.timezone === "string" &&
            organization.timezone.length > 0
                ? organization.timezone
                : "UTC",
        workweekStartDay:
            typeof organization.workweekStartDay === "number"
                ? organization.workweekStartDay
                : 1,
        notes:
            typeof organization.notes === "string" ? organization.notes : null,
        venues: organization.venues ?? [],
        positions: organization.positions ?? [],
        rulesetIds: Array.isArray(organization.rulesetIds)
            ? Array.from(new Set(organization.rulesetIds))
            : [],
    };
}

function normalizeStoredRuleset(
    ruleset: Ruleset & { organizationId?: Id },
): Ruleset {
    const { organizationId: _legacyOrganizationId, ...normalized } = ruleset;
    return normalized;
}

function resolveRulesetAssociations(
    organizations: Organization[],
    rulesets: Array<Ruleset & { organizationId?: Id }>,
): { organizations: Organization[]; rulesets: Ruleset[] } {
    const rulesetIdsByOrg = new Map<Id, Id[]>();
    const normalizedRulesets = rulesets.map((ruleset) => {
        if (ruleset.organizationId) {
            const existing = rulesetIdsByOrg.get(ruleset.organizationId) ?? [];
            existing.push(ruleset.rulesetId);
            rulesetIdsByOrg.set(ruleset.organizationId, existing);
        }

        return normalizeStoredRuleset(ruleset);
    });

    const knownRulesetIds = new Set(
        normalizedRulesets.map((ruleset) => ruleset.rulesetId),
    );

    return {
        organizations: organizations.map((organization) => {
            const current = Array.isArray(organization.rulesetIds)
                ? organization.rulesetIds.filter((rulesetId) =>
                      knownRulesetIds.has(rulesetId),
                  )
                : [];
            const derived =
                rulesetIdsByOrg.get(organization.organizationId) ?? [];

            return normalizeStoredOrganization({
                ...organization,
                rulesetIds: Array.from(new Set([...current, ...derived])),
            });
        }),
        rulesets: normalizedRulesets,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function migrationSentinelKey(uid: string): string {
    return `${LOCAL_STORAGE_PREFIX}:firebase-migrated:v${FIREBASE_MIGRATION_VERSION}:${uid}`;
}

function readArrayFromLocalStorage(
    storage: Storage,
    key: string,
): Result<unknown[]> {
    const raw = storage.getItem(key);

    if (!raw || raw.trim().length === 0) {
        return ok([]);
    }

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return err({
                type: "validation",
                message: `Local migration payload at ${key} must be an array`,
                field: key,
            });
        }

        return ok(parsed);
    } catch (error) {
        return err({
            type: "validation",
            message: `Local migration payload at ${key} is not valid JSON`,
            field: key,
        });
    }
}

function validateMigratedEntry(
    candidate: unknown,
    index: number,
): Result<StoredEntry> {
    if (!isRecord(candidate)) {
        return err({
            type: "validation",
            message: `Local entry at index ${index} is not an object`,
            field: `${LOCAL_ENTRIES_KEY}[${index}]`,
        });
    }

    const migrated: StoredEntry = {
        entryId:
            typeof candidate.entryId === "string"
                ? (candidate.entryId as Id)
                : ("" as Id),
        organizationId:
            typeof candidate.organizationId === "string"
                ? (candidate.organizationId as Id)
                : ("" as Id),
        date:
            typeof candidate.date === "string"
                ? candidate.date
                : typeof candidate.dateWorked === "string"
                  ? candidate.dateWorked
                  : "",
        startTime:
            typeof candidate.startTime === "string" ? candidate.startTime : "",
        endTime: typeof candidate.endTime === "string" ? candidate.endTime : "",
        venue:
            typeof candidate.venue === "string"
                ? candidate.venue
                : candidate.venue == null
                  ? ""
                  : String(candidate.venue),
        position:
            typeof candidate.position === "string" ? candidate.position : "",
        rate:
            typeof candidate.rate === "number" || candidate.rate === null
                ? candidate.rate
                : null,
        event:
            typeof candidate.event === "string"
                ? candidate.event
                : candidate.event == null
                  ? ""
                  : String(candidate.event),
        tags:
            Array.isArray(candidate.tags) &&
            candidate.tags.every((tag) => typeof tag === "string")
                ? (candidate.tags as string[])
                : [],
        notes:
            typeof candidate.notes === "string"
                ? candidate.notes
                : candidate.notes == null
                  ? ""
                  : String(candidate.notes),
        mealPenaltyCount:
            typeof candidate.mealPenaltyCount === "number"
                ? candidate.mealPenaltyCount
                : 0,
        createdAt:
            typeof candidate.createdAt === "string" ? candidate.createdAt : "",
        updatedAt:
            typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
    };

    if (
        candidate.paymentMode === "hourly" ||
        candidate.paymentMode === "flat-fee"
    ) {
        migrated.paymentMode = candidate.paymentMode;
    }

    if (
        typeof candidate.flatFeeAmount === "number" ||
        candidate.flatFeeAmount === null
    ) {
        migrated.flatFeeAmount = candidate.flatFeeAmount;
    }

    if (!validateEntry(normalizeStoredEntry(migrated))) {
        return err({
            type: "validation",
            message: `Local entry at index ${index} failed schema validation`,
            field: `${LOCAL_ENTRIES_KEY}[${index}]`,
        });
    }

    return ok(normalizeStoredEntry(migrated));
}

function validateMigratedOrganization(
    candidate: unknown,
    index: number,
): Result<Organization> {
    if (!isRecord(candidate)) {
        return err({
            type: "validation",
            message: `Local organization at index ${index} is not an object`,
            field: `${LOCAL_ORGANIZATIONS_KEY}[${index}]`,
        });
    }

    const migrated: Organization = {
        ...(candidate as Partial<Organization>),
        timezone:
            typeof candidate.timezone === "string" &&
            candidate.timezone.length > 0
                ? candidate.timezone
                : "UTC",
        workweekStartDay:
            typeof candidate.workweekStartDay === "number"
                ? candidate.workweekStartDay
                : 1,
        notes:
            typeof candidate.notes === "string"
                ? candidate.notes
                : candidate.notes == null
                  ? null
                  : String(candidate.notes),
        venues: Array.isArray(candidate.venues)
            ? candidate.venues.filter(
                  (venue): venue is string => typeof venue === "string",
              )
            : [],
        positions: Array.isArray(candidate.positions)
            ? candidate.positions
                  .filter(isRecord)
                  .map((position) => ({
                      name:
                          typeof position.name === "string"
                              ? position.name
                              : "",
                      defaultRate:
                          typeof position.defaultRate === "number" ||
                          position.defaultRate === null
                              ? position.defaultRate
                              : undefined,
                  }))
                  .filter((position) => position.name.length > 0)
            : [],
        rulesetIds: Array.isArray(candidate.rulesetIds)
            ? candidate.rulesetIds.filter(
                  (rulesetId): rulesetId is Id => typeof rulesetId === "string",
              )
            : [],
    } as Organization;

    if (!validateOrganization(normalizeStoredOrganization(migrated))) {
        return err({
            type: "validation",
            message: `Local organization at index ${index} failed schema validation`,
            field: `${LOCAL_ORGANIZATIONS_KEY}[${index}]`,
        });
    }

    return ok(normalizeStoredOrganization(migrated));
}

function validateMigratedTag(
    candidate: unknown,
    index: number,
): Result<TagHistory> {
    if (!isRecord(candidate) || !validateTag(candidate)) {
        return err({
            type: "validation",
            message: `Local tag history at index ${index} failed schema validation`,
            field: `${LOCAL_TAGS_KEY}[${index}]`,
        });
    }

    return ok(candidate as TagHistory);
}

function validateMigratedPosition(
    candidate: unknown,
    index: number,
): Result<PositionHistory> {
    if (!isRecord(candidate) || !validatePosition(candidate)) {
        return err({
            type: "validation",
            message: `Local position history at index ${index} failed schema validation`,
            field: `${LOCAL_POSITIONS_KEY}[${index}]`,
        });
    }

    return ok(candidate as PositionHistory);
}

function validateMigratedVenue(
    candidate: unknown,
    index: number,
): Result<VenueHistory> {
    if (!isRecord(candidate) || !validateVenue(candidate)) {
        return err({
            type: "validation",
            message: `Local venue history at index ${index} failed schema validation`,
            field: `${LOCAL_VENUES_KEY}[${index}]`,
        });
    }

    return ok(candidate as VenueHistory);
}

function validateMigratedRuleset(
    candidate: unknown,
    index: number,
): Result<Ruleset & { organizationId?: Id }> {
    if (!isRecord(candidate)) {
        return err({
            type: "validation",
            message: `Local ruleset at index ${index} failed schema validation`,
            field: `${LOCAL_RULESETS_KEY}[${index}]`,
        });
    }

    const normalized = normalizeStoredRuleset(
        candidate as Ruleset & { organizationId?: Id },
    );

    if (!validateRuleset(normalized)) {
        return err({
            type: "validation",
            message: `Local ruleset at index ${index} failed schema validation`,
            field: `${LOCAL_RULESETS_KEY}[${index}]`,
        });
    }

    return ok(candidate as Ruleset & { organizationId?: Id });
}

function loadLocalMigrationPayload(
    storage: Storage,
): Result<LocalMigrationPayload> {
    const entriesRaw = readArrayFromLocalStorage(storage, LOCAL_ENTRIES_KEY);
    if (!entriesRaw.success) {
        return entriesRaw;
    }

    const organizationsRaw = readArrayFromLocalStorage(
        storage,
        LOCAL_ORGANIZATIONS_KEY,
    );
    if (!organizationsRaw.success) {
        return organizationsRaw;
    }

    const tagsRaw = readArrayFromLocalStorage(storage, LOCAL_TAGS_KEY);
    if (!tagsRaw.success) {
        return tagsRaw;
    }

    const positionsRaw = readArrayFromLocalStorage(
        storage,
        LOCAL_POSITIONS_KEY,
    );
    if (!positionsRaw.success) {
        return positionsRaw;
    }

    const venuesRaw = readArrayFromLocalStorage(storage, LOCAL_VENUES_KEY);
    if (!venuesRaw.success) {
        return venuesRaw;
    }

    const rulesetsRaw = readArrayFromLocalStorage(storage, LOCAL_RULESETS_KEY);
    if (!rulesetsRaw.success) {
        return rulesetsRaw;
    }

    const entries: StoredEntry[] = [];
    for (let i = 0; i < entriesRaw.data.length; i += 1) {
        const result = validateMigratedEntry(entriesRaw.data[i], i);
        if (!result.success) {
            return result;
        }
        entries.push(result.data);
    }

    const organizations: Organization[] = [];
    for (let i = 0; i < organizationsRaw.data.length; i += 1) {
        const result = validateMigratedOrganization(
            organizationsRaw.data[i],
            i,
        );
        if (!result.success) {
            return result;
        }
        organizations.push(result.data);
    }

    const tags: TagHistory[] = [];
    for (let i = 0; i < tagsRaw.data.length; i += 1) {
        const result = validateMigratedTag(tagsRaw.data[i], i);
        if (!result.success) {
            return result;
        }
        tags.push(result.data);
    }

    const positions: PositionHistory[] = [];
    for (let i = 0; i < positionsRaw.data.length; i += 1) {
        const result = validateMigratedPosition(positionsRaw.data[i], i);
        if (!result.success) {
            return result;
        }
        positions.push(result.data);
    }

    const venues: VenueHistory[] = [];
    for (let i = 0; i < venuesRaw.data.length; i += 1) {
        const result = validateMigratedVenue(venuesRaw.data[i], i);
        if (!result.success) {
            return result;
        }
        venues.push(result.data);
    }

    const rulesets: Array<Ruleset & { organizationId?: Id }> = [];
    for (let i = 0; i < rulesetsRaw.data.length; i += 1) {
        const result = validateMigratedRuleset(rulesetsRaw.data[i], i);
        if (!result.success) {
            return result;
        }
        rulesets.push(result.data);
    }

    const resolvedAssociations = resolveRulesetAssociations(
        organizations,
        rulesets as Array<Ruleset & { organizationId?: Id }>,
    );

    return ok({
        entries,
        organizations: resolvedAssociations.organizations,
        tags,
        positions,
        venues,
        rulesets: resolvedAssociations.rulesets,
    });
}

async function migrateLocalJsonDataToFirestore(
    scope: FirebaseScope,
): Promise<Result<void>> {
    const storage = getStorage();

    if (!storage) {
        return ok(undefined);
    }

    const sentinelKey = migrationSentinelKey(scope.uid);

    if (storage.getItem(sentinelKey)) {
        return ok(undefined);
    }

    const payload = loadLocalMigrationPayload(storage);
    if (!payload.success) {
        return payload;
    }

    const writeWithContext = async (
        collectionName: string,
        docId: string,
        data: unknown,
    ): Promise<Result<void>> => {
        try {
            await setDoc(userDoc(scope, collectionName, docId), data);
            return ok(undefined);
        } catch (error) {
            return err({
                type: "io",
                message: `Firebase migration write failed for users/${scope.uid}/${collectionName}/${docId}`,
                cause: error instanceof Error ? error : undefined,
            });
        }
    };

    for (const organization of payload.data.organizations) {
        const write = await writeWithContext(
            COLLECTIONS.organizations,
            organization.organizationId,
            organization,
        );
        if (!write.success) {
            return write;
        }
    }

    for (const entry of payload.data.entries) {
        const write = await writeWithContext(
            COLLECTIONS.entries,
            entry.entryId,
            entry,
        );
        if (!write.success) {
            return write;
        }
    }

    for (const tag of payload.data.tags) {
        const write = await writeWithContext(
            COLLECTIONS.tags,
            normalizeKey(tag.tag),
            tag,
        );
        if (!write.success) {
            return write;
        }
    }

    for (const position of payload.data.positions) {
        const write = await writeWithContext(
            COLLECTIONS.positions,
            `${position.organizationId}__${normalizeKey(position.position)}`,
            position,
        );
        if (!write.success) {
            return write;
        }
    }

    for (const venue of payload.data.venues) {
        const write = await writeWithContext(
            COLLECTIONS.venues,
            `${venue.organizationId}__${normalizeKey(venue.venueName)}`,
            venue,
        );
        if (!write.success) {
            return write;
        }
    }

    for (const ruleset of payload.data.rulesets) {
        const write = await writeWithContext(
            COLLECTIONS.rulesets,
            ruleset.rulesetId,
            ruleset,
        );
        if (!write.success) {
            return write;
        }
    }

    try {
        storage.setItem(
            sentinelKey,
            JSON.stringify({
                version: FIREBASE_MIGRATION_VERSION,
                migratedAt: nowIso(),
                uid: scope.uid,
                counts: {
                    organizations: payload.data.organizations.length,
                    entries: payload.data.entries.length,
                    tags: payload.data.tags.length,
                    positions: payload.data.positions.length,
                    venues: payload.data.venues.length,
                    rulesets: payload.data.rulesets.length,
                },
            }),
        );
    } catch (error) {
        return err({
            type: "io",
            message:
                "Firebase migration wrote data but failed to persist local migration sentinel",
            cause: error instanceof Error ? error : undefined,
        });
    }

    return ok(undefined);
}

function userCollection(scope: FirebaseScope, collectionName: string) {
    return collection(scope.db, "users", scope.uid, collectionName);
}

function userDoc(scope: FirebaseScope, collectionName: string, id: string) {
    return doc(scope.db, "users", scope.uid, collectionName, id);
}

async function readOrganizationRecord(
    scope: FirebaseScope,
    organizationId: Id,
): Promise<Result<Organization | null>> {
    try {
        const snapshot = await getDoc(
            userDoc(scope, COLLECTIONS.organizations, organizationId),
        );

        if (!snapshot.exists()) {
            return ok(null);
        }

        return ok(normalizeStoredOrganization(snapshot.data() as Organization));
    } catch (error) {
        return err(ioError("organization get", error));
    }
}

async function validateOrganizationRulesetReferences(
    scope: FirebaseScope,
    rulesetIds: Id[],
): Promise<Result<void>> {
    for (const rulesetId of Array.from(new Set(rulesetIds))) {
        try {
            const snapshot = await getDoc(
                userDoc(scope, COLLECTIONS.rulesets, rulesetId),
            );
            if (!snapshot.exists()) {
                return notFound("Ruleset", rulesetId);
            }
        } catch (error) {
            return err(ioError("organization ruleset validation", error));
        }
    }

    return ok(undefined);
}

async function readRulesetsForOrganization(
    scope: FirebaseScope,
    organizationId: Id,
): Promise<Result<Ruleset[]>> {
    const organizationResult = await readOrganizationRecord(
        scope,
        organizationId,
    );
    if (!organizationResult.success) {
        return organizationResult as Result<Ruleset[]>;
    }

    if (!organizationResult.data) {
        return ok([]);
    }

    const rulesetsById = new Map<Id, Ruleset>();

    for (const rulesetId of organizationResult.data.rulesetIds) {
        try {
            const snapshot = await getDoc(
                userDoc(scope, COLLECTIONS.rulesets, rulesetId),
            );
            if (snapshot.exists()) {
                const normalized = normalizeStoredRuleset(
                    snapshot.data() as Ruleset & { organizationId?: Id },
                );
                rulesetsById.set(normalized.rulesetId, normalized);
            }
        } catch (error) {
            return err(ioError("ruleset listByOrg", error));
        }
    }

    try {
        const legacySnapshots = await getDocs(
            query(
                userCollection(scope, COLLECTIONS.rulesets),
                where("organizationId", "==", organizationId),
            ),
        );

        for (const snapshot of legacySnapshots.docs) {
            const normalized = normalizeStoredRuleset(
                snapshot.data() as Ruleset & { organizationId?: Id },
            );
            rulesetsById.set(normalized.rulesetId, normalized);
        }
    } catch (error) {
        return err(ioError("ruleset legacy listByOrg", error));
    }

    return ok(
        Array.from(rulesetsById.values()).sort((a, b) =>
            b.effectiveDate.localeCompare(a.effectiveDate),
        ),
    );
}

class FirebaseAdapterContext {
    private cachedScope: FirebaseScope | null = null;
    private scopePromise: Promise<FirebaseScope> | null = null;

    async getScope(): Promise<Result<FirebaseScope>> {
        if (this.cachedScope) {
            return ok(this.cachedScope);
        }

        if (!this.scopePromise) {
            this.scopePromise = this.resolveScope();
        }

        try {
            const scope = await this.scopePromise;
            this.cachedScope = scope;
            return ok(scope);
        } catch (error) {
            this.scopePromise = null;
            const cause = error instanceof Error ? error : undefined;
            const message =
                error instanceof Error ? error.message : "Unknown error";

            return err({
                type: "io",
                message:
                    "Firebase adapter is enabled but could not resolve authenticated storage scope. " +
                    "Ensure VITE_FREELANCE_DATA_ADAPTER=firebase is only set when Firebase env config is present and anonymous auth bootstrap is available. " +
                    `Root cause: ${message}`,
                cause,
            });
        }
    }

    private async resolveScope(): Promise<FirebaseScope> {
        const uid = await withTimeout(
            ensureAnonymousUser(),
            10000,
            "ensureAnonymousUser",
        );
        const db = getFirebaseFirestore();

        if (!uid || uid.trim().length === 0) {
            throw new Error(
                "Anonymous auth completed without a uid. Verify Firebase auth bootstrap wiring.",
            );
        }

        return { db, uid };
    }
}

class FirebaseEntryRepository implements IEntryRepository {
    constructor(private context: FirebaseAdapterContext) {}

    async create(
        entry: Omit<Entry, "entryId" | "createdAt" | "updatedAt">,
    ): Promise<Result<Entry>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        const timestamp = nowIso();
        const createdEntry = toStoredEntry(
            entry as EntryCreateInput,
            timestamp,
        );

        if (!validateEntry(normalizeStoredEntry(createdEntry))) {
            return err({
                type: "validation",
                message: "Entry validation failed",
                field: "entry",
            });
        }

        try {
            await setDoc(
                userDoc(scope.data, COLLECTIONS.entries, createdEntry.entryId),
                normalizeStoredEntry(createdEntry),
            );
            return ok(toDomainEntry(normalizeStoredEntry(createdEntry)));
        } catch (error) {
            return err(ioError("entry create", error));
        }
    }

    async list(params: {
        organizationId: Id;
        startDate: string;
        endDate: string;
    }): Promise<Result<Entry[]>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const entriesQuery = query(
                userCollection(scope.data, COLLECTIONS.entries),
                where("organizationId", "==", params.organizationId),
                where("date", ">=", params.startDate),
                where("date", "<=", params.endDate),
            );
            const snapshots = await getDocs(entriesQuery);
            const entries: Entry[] = snapshots.docs
                .map((snapshot) =>
                    normalizeStoredEntry(snapshot.data() as StoredEntry),
                )
                .map(toDomainEntry);
            return ok(entries);
        } catch (error) {
            return err(ioError("entry list", error));
        }
    }

    async getById(entryId: Id): Promise<Result<Entry>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshot = await getDoc(
                userDoc(scope.data, COLLECTIONS.entries, entryId),
            );

            if (!snapshot.exists()) {
                return notFound("Entry", entryId);
            }

            return ok(
                toDomainEntry(
                    normalizeStoredEntry(snapshot.data() as StoredEntry),
                ),
            );
        } catch (error) {
            return err(ioError("entry getById", error));
        }
    }

    async update(entryId: Id, update: Partial<Entry>): Promise<Result<Entry>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const docRef = userDoc(scope.data, COLLECTIONS.entries, entryId);
            const currentSnapshot = await getDoc(docRef);

            if (!currentSnapshot.exists()) {
                return notFound("Entry", entryId);
            }

            const current = normalizeStoredEntry(
                currentSnapshot.data() as StoredEntry,
            );
            const { dateWorked, ...rest } = update as Partial<Entry> & {
                date?: string;
            };

            const nextEntry: StoredEntry = {
                ...current,
                ...(rest as Partial<StoredEntry>),
                date:
                    dateWorked ??
                    (update as EntryCreateInput).date ??
                    current.date,
                venue: "venue" in rest ? (rest.venue ?? "") : current.venue,
                event: "event" in rest ? (rest.event ?? "") : current.event,
                notes: "notes" in rest ? (rest.notes ?? "") : current.notes,
                entryId,
                createdAt: current.createdAt,
                updatedAt: nowIso(current.updatedAt),
            };

            if (!validateEntry(normalizeStoredEntry(nextEntry))) {
                return err({
                    type: "validation",
                    message: "Updated entry validation failed",
                    field: "entry",
                });
            }

            await setDoc(docRef, normalizeStoredEntry(nextEntry));
            return ok(toDomainEntry(normalizeStoredEntry(nextEntry)));
        } catch (error) {
            return err(ioError("entry update", error));
        }
    }

    async delete(entryId: Id): Promise<Result<void>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const docRef = userDoc(scope.data, COLLECTIONS.entries, entryId);
            const snapshot = await getDoc(docRef);

            if (!snapshot.exists()) {
                return notFound("Entry", entryId);
            }

            await deleteDoc(docRef);
            return ok(undefined);
        } catch (error) {
            return err(ioError("entry delete", error));
        }
    }
}

class FirebaseOrganizationRepository implements IOrganizationRepository {
    constructor(private context: FirebaseAdapterContext) {}

    async create(org: CreateOrganizationInput): Promise<Result<Organization>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        const created: Organization = {
            ...org,
            timezone: org.timezone ?? "UTC",
            workweekStartDay: org.workweekStartDay ?? 1,
            notes: org.notes ?? null,
            venues: org.venues ?? [],
            positions: org.positions ?? [],
            rulesetIds: Array.from(new Set(org.rulesetIds ?? [])),
            organizationId: genId("org"),
            createdAt: nowIso(),
        };

        const rulesetValidation = await validateOrganizationRulesetReferences(
            scope.data,
            created.rulesetIds,
        );
        if (!rulesetValidation.success) {
            return rulesetValidation;
        }

        if (!validateOrganization(normalizeStoredOrganization(created))) {
            return err({
                type: "validation",
                message: "Organization validation failed",
                field: "organization",
            });
        }

        try {
            await setDoc(
                userDoc(
                    scope.data,
                    COLLECTIONS.organizations,
                    created.organizationId,
                ),
                normalizeStoredOrganization(created),
            );
            return ok(normalizeStoredOrganization(created));
        } catch (error) {
            return err(ioError("organization create", error));
        }
    }

    async get(organizationId: Id): Promise<Result<Organization>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshot = await getDoc(
                userDoc(scope.data, COLLECTIONS.organizations, organizationId),
            );

            if (!snapshot.exists()) {
                return notFound("Organization", organizationId);
            }

            return ok(
                normalizeStoredOrganization(snapshot.data() as Organization),
            );
        } catch (error) {
            return err(ioError("organization get", error));
        }
    }

    async list(): Promise<Result<Organization[]>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshots = await getDocs(
                userCollection(scope.data, COLLECTIONS.organizations),
            );
            return ok(
                snapshots.docs.map((snapshot) =>
                    normalizeStoredOrganization(
                        snapshot.data() as Organization,
                    ),
                ),
            );
        } catch (error) {
            return err(ioError("organization list", error));
        }
    }

    async update(
        organizationId: Id,
        update: Partial<Organization>,
    ): Promise<Result<Organization>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const docRef = userDoc(
                scope.data,
                COLLECTIONS.organizations,
                organizationId,
            );
            const snapshot = await getDoc(docRef);

            if (!snapshot.exists()) {
                return notFound("Organization", organizationId);
            }

            const current = normalizeStoredOrganization(
                snapshot.data() as Organization,
            );
            const next: Organization = {
                ...current,
                ...update,
                rulesetIds: Array.from(
                    new Set(update.rulesetIds ?? current.rulesetIds ?? []),
                ),
                organizationId,
                createdAt: current.createdAt,
            };

            const rulesetValidation =
                await validateOrganizationRulesetReferences(
                    scope.data,
                    next.rulesetIds,
                );
            if (!rulesetValidation.success) {
                return rulesetValidation;
            }

            if (!validateOrganization(normalizeStoredOrganization(next))) {
                return err({
                    type: "validation",
                    message: "Updated organization validation failed",
                    field: "organization",
                });
            }

            await setDoc(docRef, normalizeStoredOrganization(next));
            return ok(normalizeStoredOrganization(next));
        } catch (error) {
            return err(ioError("organization update", error));
        }
    }

    async delete(organizationId: Id): Promise<Result<void>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const docRef = userDoc(
                scope.data,
                COLLECTIONS.organizations,
                organizationId,
            );
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) {
                return notFound("Organization", organizationId);
            }

            await deleteDoc(docRef);
            return ok(undefined);
        } catch (error) {
            return err(ioError("organization delete", error));
        }
    }
}

class FirebaseTagHistoryRepository implements ITagHistoryRepository {
    constructor(private context: FirebaseAdapterContext) {}

    async getAll(): Promise<Result<TagHistory[]>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshots = await getDocs(
                userCollection(scope.data, COLLECTIONS.tags),
            );
            return ok(
                snapshots.docs.map((snapshot) => snapshot.data() as TagHistory),
            );
        } catch (error) {
            return err(ioError("tag getAll", error));
        }
    }

    async record(tag: string): Promise<Result<TagHistory>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        const tagKey = normalizeKey(tag);

        try {
            const docRef = userDoc(scope.data, COLLECTIONS.tags, tagKey);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                const current = snapshot.data() as TagHistory;
                const next: TagHistory = {
                    ...current,
                    count: current.count + 1,
                    lastUsedAt: nowIso(current.lastUsedAt),
                };
                await setDoc(docRef, next);
                return ok(next);
            }

            const created: TagHistory = {
                tag,
                count: 1,
                lastUsedAt: nowIso(),
            };

            if (!validateTag(created)) {
                return err({
                    type: "validation",
                    message: "Tag validation failed",
                    field: "tag",
                });
            }

            await setDoc(docRef, created);
            return ok(created);
        } catch (error) {
            return err(ioError("tag record", error));
        }
    }

    async get(tag: string): Promise<Result<TagHistory | null>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshot = await getDoc(
                userDoc(scope.data, COLLECTIONS.tags, normalizeKey(tag)),
            );

            if (!snapshot.exists()) {
                return ok(null);
            }

            return ok(snapshot.data() as TagHistory);
        } catch (error) {
            return err(ioError("tag get", error));
        }
    }
}

class FirebasePositionHistoryRepository implements IPositionHistoryRepository {
    constructor(private context: FirebaseAdapterContext) {}

    async getByOrg(organizationId: Id): Promise<Result<PositionHistory[]>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshots = await getDocs(
                query(
                    userCollection(scope.data, COLLECTIONS.positions),
                    where("organizationId", "==", organizationId),
                ),
            );

            return ok(
                snapshots.docs.map(
                    (snapshot) => snapshot.data() as PositionHistory,
                ),
            );
        } catch (error) {
            return err(ioError("position getByOrg", error));
        }
    }

    async record(
        organizationId: Id,
        position: string,
    ): Promise<Result<PositionHistory>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        const positionId = `${organizationId}__${normalizeKey(position)}`;

        try {
            const docRef = userDoc(
                scope.data,
                COLLECTIONS.positions,
                positionId,
            );
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                const current = snapshot.data() as PositionHistory;
                const next: PositionHistory = {
                    ...current,
                    count: current.count + 1,
                    lastUsedAt: nowIso(current.lastUsedAt),
                };
                await setDoc(docRef, next);
                return ok(next);
            }

            const created: PositionHistory = {
                organizationId,
                position,
                count: 1,
                lastUsedAt: nowIso(),
            };

            if (!validatePosition(created)) {
                return err({
                    type: "validation",
                    message: "Position validation failed",
                    field: "position",
                });
            }

            await setDoc(docRef, created);
            return ok(created);
        } catch (error) {
            return err(ioError("position record", error));
        }
    }

    async get(
        organizationId: Id,
        position: string,
    ): Promise<Result<PositionHistory | null>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshot = await getDoc(
                userDoc(
                    scope.data,
                    COLLECTIONS.positions,
                    `${organizationId}__${normalizeKey(position)}`,
                ),
            );

            if (!snapshot.exists()) {
                return ok(null);
            }

            return ok(snapshot.data() as PositionHistory);
        } catch (error) {
            return err(ioError("position get", error));
        }
    }
}

class FirebaseVenueHistoryRepository implements IVenueHistoryRepository {
    constructor(private context: FirebaseAdapterContext) {}

    async getByOrg(organizationId: Id): Promise<Result<VenueHistory[]>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshots = await getDocs(
                query(
                    userCollection(scope.data, COLLECTIONS.venues),
                    where("organizationId", "==", organizationId),
                ),
            );

            return ok(
                snapshots.docs.map(
                    (snapshot) => snapshot.data() as VenueHistory,
                ),
            );
        } catch (error) {
            return err(ioError("venue getByOrg", error));
        }
    }

    async record(
        organizationId: Id,
        venueName: string,
    ): Promise<Result<VenueHistory>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        const venueId = `${organizationId}__${normalizeKey(venueName)}`;

        try {
            const docRef = userDoc(scope.data, COLLECTIONS.venues, venueId);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                const current = snapshot.data() as VenueHistory;
                const next: VenueHistory = {
                    ...current,
                    count: current.count + 1,
                    lastUsedAt: nowIso(current.lastUsedAt),
                };
                await setDoc(docRef, next);
                return ok(next);
            }

            const created: VenueHistory = {
                organizationId,
                venueName,
                count: 1,
                lastUsedAt: nowIso(),
            };

            if (!validateVenue(created)) {
                return err({
                    type: "validation",
                    message: "Venue validation failed",
                    field: "venue",
                });
            }

            await setDoc(docRef, created);
            return ok(created);
        } catch (error) {
            return err(ioError("venue record", error));
        }
    }

    async get(
        organizationId: Id,
        venueName: string,
    ): Promise<Result<VenueHistory | null>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshot = await getDoc(
                userDoc(
                    scope.data,
                    COLLECTIONS.venues,
                    `${organizationId}__${normalizeKey(venueName)}`,
                ),
            );

            if (!snapshot.exists()) {
                return ok(null);
            }

            return ok(snapshot.data() as VenueHistory);
        } catch (error) {
            return err(ioError("venue get", error));
        }
    }
}

class FirebaseRulesetRepository implements IRulesetRepository {
    constructor(private context: FirebaseAdapterContext) {}

    async create(ruleset: CreateRulesetInput): Promise<Result<Ruleset>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        const otRules = ruleset.rules.filter(
            (rule) =>
                rule.type === "daily-overtime" ||
                rule.type === "weekly-overtime",
        );

        if (otRules.length > 1) {
            const hasDaily = otRules.some(
                (rule) => rule.type === "daily-overtime",
            );
            const hasWeekly = otRules.some(
                (rule) => rule.type === "weekly-overtime",
            );
            if (hasDaily && hasWeekly) {
                return err({
                    type: "conflict",
                    message:
                        "Ruleset cannot contain both daily and weekly overtime rules",
                });
            }
        }

        const { organizationId, ...rulesetBody } = ruleset;
        const created: Ruleset = {
            rulesetId: genId("ruleset"),
            ...rulesetBody,
            createdAt: nowIso(),
        };

        if (!validateRuleset(created)) {
            return err({
                type: "validation",
                message: "Ruleset validation failed",
                field: "ruleset",
            });
        }

        try {
            if (organizationId) {
                const organizationResult = await readOrganizationRecord(
                    scope.data,
                    organizationId,
                );
                if (!organizationResult.success) {
                    return organizationResult as Result<Ruleset>;
                }
                if (!organizationResult.data) {
                    return notFound("Organization", organizationId);
                }

                const nextOrganization = normalizeStoredOrganization({
                    ...organizationResult.data,
                    rulesetIds: Array.from(
                        new Set([
                            ...organizationResult.data.rulesetIds,
                            created.rulesetId,
                        ]),
                    ),
                });

                if (!validateOrganization(nextOrganization)) {
                    return err({
                        type: "validation",
                        message:
                            "Organization validation failed after associating ruleset",
                        field: "organization.rulesetIds",
                    });
                }

                const batch = writeBatch(scope.data.db);
                batch.set(
                    userDoc(
                        scope.data,
                        COLLECTIONS.rulesets,
                        created.rulesetId,
                    ),
                    created,
                );
                batch.set(
                    userDoc(
                        scope.data,
                        COLLECTIONS.organizations,
                        organizationId,
                    ),
                    nextOrganization,
                );
                await batch.commit();
            } else {
                await setDoc(
                    userDoc(
                        scope.data,
                        COLLECTIONS.rulesets,
                        created.rulesetId,
                    ),
                    created,
                );
            }
            return ok(created);
        } catch (error) {
            return err(ioError("ruleset create", error));
        }
    }

    async getById(rulesetId: Id): Promise<Result<Ruleset>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshot = await getDoc(
                userDoc(scope.data, COLLECTIONS.rulesets, rulesetId),
            );
            if (!snapshot.exists()) {
                return notFound("Ruleset", rulesetId);
            }

            return ok(
                normalizeStoredRuleset(
                    snapshot.data() as Ruleset & { organizationId?: Id },
                ),
            );
        } catch (error) {
            return err(ioError("ruleset getById", error));
        }
    }

    async getActive(params: {
        organizationId: Id;
        onDate: string;
    }): Promise<Result<Ruleset | null>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        const rulesets = await readRulesetsForOrganization(
            scope.data,
            params.organizationId,
        );
        if (!rulesets.success) {
            return rulesets;
        }

        return ok(
            rulesets.data.find(
                (ruleset) => ruleset.effectiveDate <= params.onDate,
            ) ?? null,
        );
    }

    async listByOrg(organizationId: Id): Promise<Result<Ruleset[]>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        return readRulesetsForOrganization(scope.data, organizationId);
    }

    async listAll(): Promise<Result<Ruleset[]>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const snapshots = await getDocs(
                userCollection(scope.data, COLLECTIONS.rulesets),
            );

            return ok(
                snapshots.docs
                    .map((snapshot) =>
                        normalizeStoredRuleset(
                            snapshot.data() as Ruleset & {
                                organizationId?: Id;
                            },
                        ),
                    )
                    .sort((a, b) =>
                        b.effectiveDate.localeCompare(a.effectiveDate),
                    ),
            );
        } catch (error) {
            return err(ioError("ruleset listAll", error));
        }
    }

    async delete(rulesetId: Id): Promise<Result<void>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        try {
            const docRef = userDoc(scope.data, COLLECTIONS.rulesets, rulesetId);
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) {
                return notFound("Ruleset", rulesetId);
            }

            const organizationsSnapshot = await getDocs(
                query(
                    userCollection(scope.data, COLLECTIONS.organizations),
                    where("rulesetIds", "array-contains", rulesetId),
                ),
            );

            const batch = writeBatch(scope.data.db);
            batch.delete(docRef);

            for (const organizationSnapshot of organizationsSnapshot.docs) {
                const organization = normalizeStoredOrganization(
                    organizationSnapshot.data() as Organization,
                );
                batch.set(
                    userDoc(
                        scope.data,
                        COLLECTIONS.organizations,
                        organization.organizationId,
                    ),
                    normalizeStoredOrganization({
                        ...organization,
                        rulesetIds: organization.rulesetIds.filter(
                            (candidate) => candidate !== rulesetId,
                        ),
                    }),
                );
            }

            await batch.commit();
            return ok(undefined);
        } catch (error) {
            return err(ioError("ruleset delete", error));
        }
    }
}

class FirebaseTransactionalBuffer {
    private stagedMutations = new Map<
        string,
        { type: "set"; data: Record<string, unknown> } | { type: "delete" }
    >();
    private operationFailure: string | null = null;
    private unsupportedBoundary: string | null = null;

    constructor(private scope: FirebaseScope) {}

    markOperationFailure(reason: string): void {
        if (!this.operationFailure) {
            this.operationFailure = reason;
        }
    }

    markUnsupportedBoundary(reason: string): void {
        if (!this.unsupportedBoundary) {
            this.unsupportedBoundary = reason;
        }
        this.markOperationFailure(reason);
    }

    getOperationFailure(): string | null {
        return this.operationFailure;
    }

    private docPath(collectionName: string, id: string): string {
        return `users/${this.scope.uid}/${collectionName}/${id}`;
    }

    queueSet(
        collectionName: string,
        id: string,
        data: Record<string, unknown>,
    ): void {
        this.stagedMutations.set(this.docPath(collectionName, id), {
            type: "set",
            data,
        });
    }

    queueDelete(collectionName: string, id: string): void {
        this.stagedMutations.set(this.docPath(collectionName, id), {
            type: "delete",
        });
    }

    async readDoc<T extends Record<string, unknown>>(
        collectionName: string,
        id: string,
    ): Promise<Result<T | null>> {
        const path = this.docPath(collectionName, id);
        const staged = this.stagedMutations.get(path);
        if (staged?.type === "set") {
            return ok(staged.data as T);
        }
        if (staged?.type === "delete") {
            return ok(null);
        }

        try {
            const snapshot = await getDoc(
                userDoc(this.scope, collectionName, id),
            );
            if (!snapshot.exists()) {
                return ok(null);
            }
            return ok(snapshot.data() as T);
        } catch (error) {
            return err(
                ioError(`transaction read ${collectionName}/${id}`, error),
            );
        }
    }

    async commit(): Promise<Result<void>> {
        if (this.stagedMutations.size === 0) {
            return ok(undefined);
        }

        try {
            const batch = writeBatch(this.scope.db);

            for (const [path, mutation] of this.stagedMutations.entries()) {
                const docRef = doc(this.scope.db, path);
                if (mutation.type === "set") {
                    batch.set(docRef, mutation.data);
                } else {
                    batch.delete(docRef);
                }
            }

            await batch.commit();
            return ok(undefined);
        } catch (error) {
            return err(ioError("transaction commit", error));
        }
    }
}

function unsupportedTransactionOperation<T>(
    buffer: FirebaseTransactionalBuffer,
    operation: string,
): Result<T> {
    const message =
        "Unsupported Firebase transaction flow: only point reads and write mutations are atomic in the current F-002 transaction boundary.";

    buffer.markUnsupportedBoundary(
        `${operation} is outside the atomic boundary`,
    );
    return err({
        type: "transaction",
        message,
        attempted: operation,
    }) as Result<T>;
}

class FirebaseTransactionalEntryRepository implements IEntryRepository {
    constructor(private buffer: FirebaseTransactionalBuffer) {}

    async create(
        entry: Omit<Entry, "entryId" | "createdAt" | "updatedAt">,
    ): Promise<Result<Entry>> {
        const timestamp = nowIso();
        const createdEntry = toStoredEntry(
            entry as EntryCreateInput,
            timestamp,
        );

        if (!validateEntry(normalizeStoredEntry(createdEntry))) {
            const failure = "entries.create validation failed";
            this.buffer.markOperationFailure(failure);
            return err({
                type: "validation",
                message: "Entry validation failed",
                field: "entry",
            });
        }

        this.buffer.queueSet(
            COLLECTIONS.entries,
            createdEntry.entryId,
            normalizeStoredEntry(createdEntry),
        );
        return ok(toDomainEntry(normalizeStoredEntry(createdEntry)));
    }

    async list(_params: {
        organizationId: Id;
        startDate: string;
        endDate: string;
    }): Promise<Result<Entry[]>> {
        return unsupportedTransactionOperation<Entry[]>(
            this.buffer,
            "entries.list",
        );
    }

    async getById(entryId: Id): Promise<Result<Entry>> {
        const current = await this.buffer.readDoc<StoredEntry>(
            COLLECTIONS.entries,
            entryId,
        );
        if (!current.success) {
            this.buffer.markOperationFailure("entries.getById read failed");
            return current;
        }
        if (!current.data) {
            return notFound("Entry", entryId);
        }
        return ok(toDomainEntry(normalizeStoredEntry(current.data)));
    }

    async update(entryId: Id, update: Partial<Entry>): Promise<Result<Entry>> {
        const current = await this.buffer.readDoc<StoredEntry>(
            COLLECTIONS.entries,
            entryId,
        );
        if (!current.success) {
            this.buffer.markOperationFailure("entries.update read failed");
            return current;
        }
        if (!current.data) {
            return notFound("Entry", entryId);
        }

        const { dateWorked, ...rest } = update as Partial<Entry> & {
            date?: string;
        };

        const nextEntry: StoredEntry = {
            ...normalizeStoredEntry(current.data),
            ...(rest as Partial<StoredEntry>),
            date:
                dateWorked ??
                (update as EntryCreateInput).date ??
                current.data.date,
            venue:
                "venue" in rest
                    ? (rest.venue ?? "")
                    : (current.data.venue ?? ""),
            event: "event" in rest ? (rest.event ?? "") : current.data.event,
            notes: "notes" in rest ? (rest.notes ?? "") : current.data.notes,
            entryId,
            createdAt: current.data.createdAt,
            updatedAt: nowIso(current.data.updatedAt),
        };

        if (!validateEntry(normalizeStoredEntry(nextEntry))) {
            this.buffer.markOperationFailure(
                "entries.update validation failed",
            );
            return err({
                type: "validation",
                message: "Updated entry validation failed",
                field: "entry",
            });
        }

        this.buffer.queueSet(
            COLLECTIONS.entries,
            entryId,
            normalizeStoredEntry(nextEntry),
        );
        return ok(toDomainEntry(normalizeStoredEntry(nextEntry)));
    }

    async delete(entryId: Id): Promise<Result<void>> {
        const current = await this.buffer.readDoc<StoredEntry>(
            COLLECTIONS.entries,
            entryId,
        );
        if (!current.success) {
            this.buffer.markOperationFailure("entries.delete read failed");
            return current;
        }
        if (!current.data) {
            return notFound("Entry", entryId);
        }

        this.buffer.queueDelete(COLLECTIONS.entries, entryId);
        return ok(undefined);
    }
}

class FirebaseTransactionalOrganizationRepository implements IOrganizationRepository {
    constructor(private buffer: FirebaseTransactionalBuffer) {}

    async create(org: CreateOrganizationInput): Promise<Result<Organization>> {
        const created: Organization = {
            ...org,
            timezone: org.timezone ?? "UTC",
            workweekStartDay: org.workweekStartDay ?? 1,
            notes: org.notes ?? null,
            venues: org.venues ?? [],
            positions: org.positions ?? [],
            rulesetIds: Array.from(new Set(org.rulesetIds ?? [])),
            organizationId: genId("org"),
            createdAt: nowIso(),
        };

        for (const rulesetId of created.rulesetIds) {
            const ruleset = await this.buffer.readDoc<Ruleset>(
                COLLECTIONS.rulesets,
                rulesetId,
            );
            if (!ruleset.success) {
                this.buffer.markOperationFailure(
                    "organizations.create ruleset lookup failed",
                );
                return ruleset as Result<Organization>;
            }
            if (!ruleset.data) {
                this.buffer.markOperationFailure(
                    "organizations.create missing ruleset reference",
                );
                return notFound("Ruleset", rulesetId);
            }
        }

        if (!validateOrganization(normalizeStoredOrganization(created))) {
            this.buffer.markOperationFailure(
                "organizations.create validation failed",
            );
            return err({
                type: "validation",
                message: "Organization validation failed",
                field: "organization",
            });
        }

        this.buffer.queueSet(
            COLLECTIONS.organizations,
            created.organizationId,
            normalizeStoredOrganization(created),
        );
        return ok(normalizeStoredOrganization(created));
    }

    async get(organizationId: Id): Promise<Result<Organization>> {
        const current = await this.buffer.readDoc<Organization>(
            COLLECTIONS.organizations,
            organizationId,
        );
        if (!current.success) {
            this.buffer.markOperationFailure("organizations.get read failed");
            return current;
        }
        if (!current.data) {
            return notFound("Organization", organizationId);
        }
        return ok(normalizeStoredOrganization(current.data));
    }

    async list(): Promise<Result<Organization[]>> {
        return unsupportedTransactionOperation<Organization[]>(
            this.buffer,
            "organizations.list",
        );
    }

    async update(
        organizationId: Id,
        update: Partial<Organization>,
    ): Promise<Result<Organization>> {
        const current = await this.buffer.readDoc<Organization>(
            COLLECTIONS.organizations,
            organizationId,
        );
        if (!current.success) {
            this.buffer.markOperationFailure(
                "organizations.update read failed",
            );
            return current;
        }
        if (!current.data) {
            return notFound("Organization", organizationId);
        }

        const next: Organization = {
            ...normalizeStoredOrganization(current.data),
            ...update,
            rulesetIds: Array.from(
                new Set(update.rulesetIds ?? current.data.rulesetIds ?? []),
            ),
            organizationId,
            createdAt: current.data.createdAt,
        };

        for (const rulesetId of next.rulesetIds) {
            const ruleset = await this.buffer.readDoc<Ruleset>(
                COLLECTIONS.rulesets,
                rulesetId,
            );
            if (!ruleset.success) {
                this.buffer.markOperationFailure(
                    "organizations.update ruleset lookup failed",
                );
                return ruleset as Result<Organization>;
            }
            if (!ruleset.data) {
                this.buffer.markOperationFailure(
                    "organizations.update missing ruleset reference",
                );
                return notFound("Ruleset", rulesetId);
            }
        }

        if (!validateOrganization(normalizeStoredOrganization(next))) {
            this.buffer.markOperationFailure(
                "organizations.update validation failed",
            );
            return err({
                type: "validation",
                message: "Updated organization validation failed",
                field: "organization",
            });
        }

        this.buffer.queueSet(
            COLLECTIONS.organizations,
            organizationId,
            normalizeStoredOrganization(next),
        );
        return ok(normalizeStoredOrganization(next));
    }

    async delete(organizationId: Id): Promise<Result<void>> {
        const current = await this.buffer.readDoc<Organization>(
            COLLECTIONS.organizations,
            organizationId,
        );
        if (!current.success) {
            this.buffer.markOperationFailure(
                "organizations.delete read failed",
            );
            return current;
        }
        if (!current.data) {
            return notFound("Organization", organizationId);
        }

        this.buffer.queueDelete(COLLECTIONS.organizations, organizationId);
        return ok(undefined);
    }
}

class FirebaseTransactionalTagHistoryRepository implements ITagHistoryRepository {
    constructor(private buffer: FirebaseTransactionalBuffer) {}

    async getAll(): Promise<Result<TagHistory[]>> {
        return unsupportedTransactionOperation<TagHistory[]>(
            this.buffer,
            "tags.getAll",
        );
    }

    async record(tag: string): Promise<Result<TagHistory>> {
        const tagKey = normalizeKey(tag);
        const current = await this.buffer.readDoc<TagHistory>(
            COLLECTIONS.tags,
            tagKey,
        );
        if (!current.success) {
            this.buffer.markOperationFailure("tags.record read failed");
            return current;
        }

        if (current.data) {
            const next: TagHistory = {
                ...current.data,
                count: current.data.count + 1,
                lastUsedAt: nowIso(current.data.lastUsedAt),
            };
            this.buffer.queueSet(COLLECTIONS.tags, tagKey, next);
            return ok(next);
        }

        const created: TagHistory = {
            tag,
            count: 1,
            lastUsedAt: nowIso(),
        };

        if (!validateTag(created)) {
            this.buffer.markOperationFailure("tags.record validation failed");
            return err({
                type: "validation",
                message: "Tag validation failed",
                field: "tag",
            });
        }

        this.buffer.queueSet(COLLECTIONS.tags, tagKey, created);
        return ok(created);
    }

    async get(tag: string): Promise<Result<TagHistory | null>> {
        const result = await this.buffer.readDoc<TagHistory>(
            COLLECTIONS.tags,
            normalizeKey(tag),
        );
        if (!result.success) {
            this.buffer.markOperationFailure("tags.get read failed");
            return result;
        }

        return ok(result.data);
    }
}

class FirebaseTransactionalPositionHistoryRepository implements IPositionHistoryRepository {
    constructor(private buffer: FirebaseTransactionalBuffer) {}

    async getByOrg(_organizationId: Id): Promise<Result<PositionHistory[]>> {
        return unsupportedTransactionOperation<PositionHistory[]>(
            this.buffer,
            "positions.getByOrg",
        );
    }

    async record(
        organizationId: Id,
        position: string,
    ): Promise<Result<PositionHistory>> {
        const positionId = `${organizationId}__${normalizeKey(position)}`;
        const current = await this.buffer.readDoc<PositionHistory>(
            COLLECTIONS.positions,
            positionId,
        );
        if (!current.success) {
            this.buffer.markOperationFailure("positions.record read failed");
            return current;
        }

        if (current.data) {
            const next: PositionHistory = {
                ...current.data,
                count: current.data.count + 1,
                lastUsedAt: nowIso(current.data.lastUsedAt),
            };
            this.buffer.queueSet(COLLECTIONS.positions, positionId, next);
            return ok(next);
        }

        const created: PositionHistory = {
            organizationId,
            position,
            count: 1,
            lastUsedAt: nowIso(),
        };

        if (!validatePosition(created)) {
            this.buffer.markOperationFailure(
                "positions.record validation failed",
            );
            return err({
                type: "validation",
                message: "Position validation failed",
                field: "position",
            });
        }

        this.buffer.queueSet(COLLECTIONS.positions, positionId, created);
        return ok(created);
    }

    async get(
        organizationId: Id,
        position: string,
    ): Promise<Result<PositionHistory | null>> {
        const result = await this.buffer.readDoc<PositionHistory>(
            COLLECTIONS.positions,
            `${organizationId}__${normalizeKey(position)}`,
        );
        if (!result.success) {
            this.buffer.markOperationFailure("positions.get read failed");
            return result;
        }

        return ok(result.data);
    }
}

class FirebaseTransactionalVenueHistoryRepository implements IVenueHistoryRepository {
    constructor(private buffer: FirebaseTransactionalBuffer) {}

    async getByOrg(_organizationId: Id): Promise<Result<VenueHistory[]>> {
        return unsupportedTransactionOperation<VenueHistory[]>(
            this.buffer,
            "venues.getByOrg",
        );
    }

    async record(
        organizationId: Id,
        venueName: string,
    ): Promise<Result<VenueHistory>> {
        const venueId = `${organizationId}__${normalizeKey(venueName)}`;
        const current = await this.buffer.readDoc<VenueHistory>(
            COLLECTIONS.venues,
            venueId,
        );
        if (!current.success) {
            this.buffer.markOperationFailure("venues.record read failed");
            return current;
        }

        if (current.data) {
            const next: VenueHistory = {
                ...current.data,
                count: current.data.count + 1,
                lastUsedAt: nowIso(current.data.lastUsedAt),
            };
            this.buffer.queueSet(COLLECTIONS.venues, venueId, next);
            return ok(next);
        }

        const created: VenueHistory = {
            organizationId,
            venueName,
            count: 1,
            lastUsedAt: nowIso(),
        };

        if (!validateVenue(created)) {
            this.buffer.markOperationFailure("venues.record validation failed");
            return err({
                type: "validation",
                message: "Venue validation failed",
                field: "venue",
            });
        }

        this.buffer.queueSet(COLLECTIONS.venues, venueId, created);
        return ok(created);
    }

    async get(
        organizationId: Id,
        venueName: string,
    ): Promise<Result<VenueHistory | null>> {
        const result = await this.buffer.readDoc<VenueHistory>(
            COLLECTIONS.venues,
            `${organizationId}__${normalizeKey(venueName)}`,
        );
        if (!result.success) {
            this.buffer.markOperationFailure("venues.get read failed");
            return result;
        }

        return ok(result.data);
    }
}

class FirebaseTransactionalRulesetRepository implements IRulesetRepository {
    constructor(private buffer: FirebaseTransactionalBuffer) {}

    async create(ruleset: CreateRulesetInput): Promise<Result<Ruleset>> {
        const otRules = ruleset.rules.filter(
            (rule) =>
                rule.type === "daily-overtime" ||
                rule.type === "weekly-overtime",
        );

        if (otRules.length > 1) {
            const hasDaily = otRules.some(
                (rule) => rule.type === "daily-overtime",
            );
            const hasWeekly = otRules.some(
                (rule) => rule.type === "weekly-overtime",
            );
            if (hasDaily && hasWeekly) {
                this.buffer.markOperationFailure(
                    "rulesets.create daily/weekly OT conflict",
                );
                return err({
                    type: "conflict",
                    message:
                        "Ruleset cannot contain both daily and weekly overtime rules",
                });
            }
        }

        const { organizationId, ...rulesetBody } = ruleset;
        const created: Ruleset = {
            rulesetId: genId("ruleset"),
            ...rulesetBody,
            createdAt: nowIso(),
        };

        if (!validateRuleset(created)) {
            this.buffer.markOperationFailure(
                "rulesets.create validation failed",
            );
            return err({
                type: "validation",
                message: "Ruleset validation failed",
                field: "ruleset",
            });
        }

        if (organizationId) {
            const organization = await this.buffer.readDoc<Organization>(
                COLLECTIONS.organizations,
                organizationId,
            );
            if (!organization.success) {
                this.buffer.markOperationFailure(
                    "rulesets.create organization lookup failed",
                );
                return organization as Result<Ruleset>;
            }
            if (!organization.data) {
                this.buffer.markOperationFailure(
                    "rulesets.create missing organization reference",
                );
                return notFound("Organization", organizationId);
            }

            const nextOrganization = normalizeStoredOrganization({
                ...organization.data,
                rulesetIds: Array.from(
                    new Set([
                        ...normalizeStoredOrganization(organization.data)
                            .rulesetIds,
                        created.rulesetId,
                    ]),
                ),
            });

            if (!validateOrganization(nextOrganization)) {
                this.buffer.markOperationFailure(
                    "rulesets.create organization association validation failed",
                );
                return err({
                    type: "validation",
                    message:
                        "Organization validation failed after associating ruleset",
                    field: "organization.rulesetIds",
                });
            }

            this.buffer.queueSet(
                COLLECTIONS.organizations,
                organizationId,
                nextOrganization,
            );
        }

        this.buffer.queueSet(COLLECTIONS.rulesets, created.rulesetId, created);
        return ok(created);
    }

    async getById(rulesetId: Id): Promise<Result<Ruleset>> {
        const current = await this.buffer.readDoc<Ruleset>(
            COLLECTIONS.rulesets,
            rulesetId,
        );
        if (!current.success) {
            this.buffer.markOperationFailure("rulesets.getById read failed");
            return current;
        }
        if (!current.data) {
            return notFound("Ruleset", rulesetId);
        }
        return ok(
            normalizeStoredRuleset(
                current.data as Ruleset & { organizationId?: Id },
            ),
        );
    }

    async getActive(_params: {
        organizationId: Id;
        onDate: string;
    }): Promise<Result<Ruleset | null>> {
        return unsupportedTransactionOperation<Ruleset | null>(
            this.buffer,
            "rulesets.getActive",
        );
    }

    async listByOrg(_organizationId: Id): Promise<Result<Ruleset[]>> {
        return unsupportedTransactionOperation<Ruleset[]>(
            this.buffer,
            "rulesets.listByOrg",
        );
    }

    async listAll(): Promise<Result<Ruleset[]>> {
        return unsupportedTransactionOperation<Ruleset[]>(
            this.buffer,
            "rulesets.listAll",
        );
    }

    async delete(rulesetId: Id): Promise<Result<void>> {
        const current = await this.buffer.readDoc<Ruleset>(
            COLLECTIONS.rulesets,
            rulesetId,
        );
        if (!current.success) {
            this.buffer.markOperationFailure("rulesets.delete read failed");
            return current;
        }
        if (!current.data) {
            return notFound("Ruleset", rulesetId);
        }

        return unsupportedTransactionOperation<void>(
            this.buffer,
            "rulesets.delete",
        );
    }
}

class FirebaseTransactionContext implements ITransactionContext {
    private shouldRollback = false;
    private rollbackReason = "";
    private readonly buffer: FirebaseTransactionalBuffer;

    entries: IEntryRepository;
    organizations: IOrganizationRepository;
    tags: ITagHistoryRepository;
    positions: IPositionHistoryRepository;
    venues: IVenueHistoryRepository;
    rulesets: IRulesetRepository;

    constructor(scope: FirebaseScope) {
        this.buffer = new FirebaseTransactionalBuffer(scope);
        this.entries = new FirebaseTransactionalEntryRepository(this.buffer);
        this.organizations = new FirebaseTransactionalOrganizationRepository(
            this.buffer,
        );
        this.tags = new FirebaseTransactionalTagHistoryRepository(this.buffer);
        this.positions = new FirebaseTransactionalPositionHistoryRepository(
            this.buffer,
        );
        this.venues = new FirebaseTransactionalVenueHistoryRepository(
            this.buffer,
        );
        this.rulesets = new FirebaseTransactionalRulesetRepository(this.buffer);
    }

    rollback(reason: string): void {
        this.shouldRollback = true;
        this.rollbackReason = reason;
    }

    isRollbackRequested(): boolean {
        return this.shouldRollback;
    }

    getRollbackReason(): string {
        return this.rollbackReason;
    }

    getBuffer(): FirebaseTransactionalBuffer {
        return this.buffer;
    }
}

class FirebaseTransactionManager implements ITransactionManager {
    constructor(private context: FirebaseAdapterContext) {}

    async transaction<T>(
        fn: (tx: ITransactionContext) => Promise<Result<T>>,
    ): Promise<Result<T>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        const txContext = new FirebaseTransactionContext(scope.data);

        try {
            const result = await fn(txContext);

            const operationFailure = txContext
                .getBuffer()
                .getOperationFailure();
            if (operationFailure) {
                return err({
                    type: "transaction",
                    message:
                        "Firebase transaction aborted before commit because an operation failed or crossed an unsupported boundary.",
                    attempted: operationFailure,
                });
            }

            if (txContext.isRollbackRequested()) {
                return err({
                    type: "transaction",
                    message:
                        "Firebase transaction rollback requested before commit; no staged writes were persisted.",
                    attempted: txContext.getRollbackReason(),
                });
            }

            if (!result.success) {
                return result;
            }

            const commit = await txContext.getBuffer().commit();
            if (!commit.success) {
                return err({
                    type: "transaction",
                    message:
                        "Firebase transaction commit failed; no staged writes were committed.",
                    attempted:
                        commit.error.type === "io"
                            ? commit.error.message
                            : "transaction commit",
                });
            }

            return result;
        } catch (error) {
            return err({
                type: "transaction",
                message: "Firebase transaction execution failed before commit.",
                attempted:
                    error instanceof Error
                        ? error.message
                        : "Unknown transaction failure",
            });
        }
    }
}

export class FirebaseDataLayer implements IDataLayer {
    private readonly context = new FirebaseAdapterContext();

    entries: IEntryRepository;
    organizations: IOrganizationRepository;
    tags: ITagHistoryRepository;
    positions: IPositionHistoryRepository;
    venues: IVenueHistoryRepository;
    rulesets: IRulesetRepository;
    transaction: ITransactionManager;

    constructor() {
        this.entries = new FirebaseEntryRepository(this.context);
        this.organizations = new FirebaseOrganizationRepository(this.context);
        this.tags = new FirebaseTagHistoryRepository(this.context);
        this.positions = new FirebasePositionHistoryRepository(this.context);
        this.venues = new FirebaseVenueHistoryRepository(this.context);
        this.rulesets = new FirebaseRulesetRepository(this.context);
        this.transaction = new FirebaseTransactionManager(this.context);
    }

    async initialize(): Promise<Result<void>> {
        const scope = await this.context.getScope();
        if (!scope.success) {
            return scope;
        }

        const migration = await migrateLocalJsonDataToFirestore(scope.data);
        if (!migration.success) {
            return migration;
        }

        return ok(undefined);
    }

    async dispose(): Promise<void> {
        // No-op for now. Firestore client lifecycle is managed by Firebase SDK.
    }
}
