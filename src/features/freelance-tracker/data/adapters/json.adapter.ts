/**
 * JSON Adapter: localStorage-backed DAL implementation
 * Implements IDataLayer using JSON storage in localStorage
 *
 * Storage structure:
 * - localStorage['freelance-tracker:entries'] = JSON string
 * - localStorage['freelance-tracker:organizations'] = JSON string
 * - localStorage['freelance-tracker:tag-history'] = JSON string
 * - localStorage['freelance-tracker:position-history'] = JSON string
 * - localStorage['freelance-tracker:venue-history'] = JSON string
 */

import { v4 as uuidv4 } from "uuid";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import type {
    Entry,
    Organization,
    TagHistory,
    PositionHistory,
    VenueHistory,
    Ruleset,
    Id,
    Result,
    DalError,
} from "../../contracts/types";
import { ok, err } from "../../contracts/types";
import type {
    IEntryRepository,
    IOrganizationRepository,
    ITagHistoryRepository,
    IPositionHistoryRepository,
    IVenueHistoryRepository,
    IRulesetRepository,
    ITransactionManager,
    ITransactionContext,
    IDataLayer,
} from "../dal";
import entrySchema from "../../../../../data/schema/entry.schema.json";
import organizationSchema from "../../../../../data/schema/organization.schema.json";
import tagHistorySchema from "../../../../../data/schema/tag-history.schema.json";
import positionHistorySchema from "../../../../../data/schema/position-history.schema.json";
import venueHistorySchema from "../../../../../data/schema/venue-history.schema.json";
import rulesetSchema from "../../../../../data/schema/ruleset.schema.json";

const STORAGE_PREFIX = "freelance-tracker";
const ENTRIES_KEY = `${STORAGE_PREFIX}:entries`;
const ORGS_KEY = `${STORAGE_PREFIX}:organizations`;
const TAGS_KEY = `${STORAGE_PREFIX}:tags`;
const POSITIONS_KEY = `${STORAGE_PREFIX}:positions`;
const VENUES_KEY = `${STORAGE_PREFIX}:venues`;
const RULESETS_KEY = `${STORAGE_PREFIX}:rulesets`;

// Helper to generate branded IDs
const genId = (prefix: string): Id =>
    `${prefix}-${uuidv4().replace(/-/g, "")}` as Id;

type EntryCreateInput = Omit<Entry, "entryId" | "createdAt" | "updatedAt"> & {
    date?: string;
};

type StoredEntry = Omit<Entry, "dateWorked"> & {
    date: string;
};

// JSON Schema validators
const ajv = new Ajv();
addFormats(ajv);
const validateEntry = ajv.compile(entrySchema);
const validateOrganization = ajv.compile(organizationSchema);
const validateTag = ajv.compile(tagHistorySchema);
const validatePosition = ajv.compile(positionHistorySchema);
const validateVenue = ajv.compile(venueHistorySchema);
const validateRuleset = ajv.compile(rulesetSchema);

/**
 * MemoryStore: in-memory copy of localStorage data (for transaction support)
 */
interface MemoryStore {
    entries: StoredEntry[];
    organizations: Organization[];
    tags: TagHistory[];
    positions: PositionHistory[];
    venues: VenueHistory[];
    rulesets: Ruleset[];
}

type MutationCallback = () => void;

function toStoredEntry(input: EntryCreateInput, now: string): StoredEntry {
    const rawDate = input.dateWorked ?? input.date;

    const stored: StoredEntry = {
        organizationId: input.organizationId,
        date: rawDate || "",
        startTime: input.startTime,
        endTime: input.endTime,
        venue: input.venue ?? "",
        position: input.position,
        rate: input.rate ?? null,
        event: input.event ?? "",
        tags: input.tags ?? [],
        notes: input.notes ?? "",
        mealPenaltyCount: input.mealPenaltyCount ?? 0,
        entryId: genId("entry"),
        createdAt: now,
        updatedAt: now,
    };

    if (input.paymentMode !== undefined) {
        stored.paymentMode = input.paymentMode;
    }

    if (input.flatFeeAmount !== undefined) {
        stored.flatFeeAmount = input.flatFeeAmount;
    }

    return stored;
}

function toDomainEntry(entry: StoredEntry): Entry {
    const domainEntry: Entry = {
        entryId: entry.entryId,
        organizationId: entry.organizationId,
        dateWorked: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        venue: entry.venue || null,
        position: entry.position,
        rate: entry.rate,
        event: entry.event || null,
        tags: entry.tags,
        notes: entry.notes || null,
        mealPenaltyCount: entry.mealPenaltyCount ?? 0,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
    };

    if (entry.paymentMode !== undefined) {
        domainEntry.paymentMode = entry.paymentMode;
    }

    if (entry.flatFeeAmount !== undefined) {
        domainEntry.flatFeeAmount = entry.flatFeeAmount;
    }

    return domainEntry;
}

function nextIsoTimestamp(previous?: string): string {
    const now = new Date();

    if (previous) {
        const previousTime = new Date(previous).getTime();
        if (!Number.isNaN(previousTime) && now.getTime() <= previousTime) {
            return new Date(previousTime + 1).toISOString();
        }
    }

    return now.toISOString();
}

function getStorage(): Storage | null {
    return globalThis.window?.localStorage ?? globalThis.localStorage ?? null;
}

function normalizeStoredEntry(entry: StoredEntry): StoredEntry {
    return {
        ...entry,
        venue: entry.venue ?? "",
        event: entry.event ?? "",
        notes: entry.notes ?? "",
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
    };
}

/**
 * TransactionContextImpl: coordinator for transactional operations
 */
class TransactionContextImpl implements ITransactionContext {
    private store: MemoryStore;
    private shouldRollback = false;
    private rollbackReason = "";

    entries: IEntryRepository;
    organizations: IOrganizationRepository;
    tags: ITagHistoryRepository;
    positions: IPositionHistoryRepository;
    venues: IVenueHistoryRepository;
    rulesets: IRulesetRepository;

    constructor(
        store: MemoryStore,
        txEntries: IEntryRepository,
        txOrgs: IOrganizationRepository,
        txTags: ITagHistoryRepository,
        txPositions: IPositionHistoryRepository,
        txVenues: IVenueHistoryRepository,
        txRulesets: IRulesetRepository,
    ) {
        this.store = store;
        this.entries = txEntries;
        this.organizations = txOrgs;
        this.tags = txTags;
        this.positions = txPositions;
        this.venues = txVenues;
        this.rulesets = txRulesets;
    }

    rollback(reason: string): void {
        this.shouldRollback = true;
        this.rollbackReason = reason;
    }

    isFlaggedForRollback(): boolean {
        return this.shouldRollback;
    }

    getRollbackReason(): string {
        return this.rollbackReason;
    }
}

/**
 * EntryRepositoryImpl: CRUD operations for entries
 */
class EntryRepositoryImpl implements IEntryRepository {
    constructor(
        private store: MemoryStore,
        private onMutation?: MutationCallback,
        private onRead?: () => void,
    ) {}

    async create(
        entry: Omit<Entry, "entryId" | "createdAt" | "updatedAt">,
    ): Promise<Result<Entry>> {
        const now = nextIsoTimestamp();
        const newEntry = toStoredEntry(entry as EntryCreateInput, now);

        if (!validateEntry(newEntry)) {
            return err({
                type: "validation",
                message: "Entry validation failed",
                field: "entry",
            });
        }

        this.store.entries.push(newEntry);
        this.onMutation?.();
        return ok(toDomainEntry(newEntry));
    }

    async list(params: {
        organizationId: Id;
        startDate: string;
        endDate: string;
    }): Promise<Result<Entry[]>> {
        this.onRead?.();
        const entries = this.store.entries
            .map(normalizeStoredEntry)
            .filter(
                (e) =>
                    e.organizationId === params.organizationId &&
                    e.date >= params.startDate &&
                    e.date <= params.endDate,
            );
        return ok(entries.map(toDomainEntry));
    }

    async getById(entryId: Id): Promise<Result<Entry>> {
        this.onRead?.();
        const entry = this.store.entries.find((e) => e.entryId === entryId);
        if (!entry) {
            return err({
                type: "notFound",
                entityType: "Entry",
                id: entryId,
            });
        }
        return ok(toDomainEntry(normalizeStoredEntry(entry)));
    }

    async update(entryId: Id, update: Partial<Entry>): Promise<Result<Entry>> {
        const index = this.store.entries.findIndex(
            (e) => e.entryId === entryId,
        );
        if (index === -1) {
            return err({
                type: "notFound",
                entityType: "Entry",
                id: entryId,
            });
        }

        const { dateWorked, ...restUpdate } = update as Partial<Entry> & {
            date?: string;
        };

        const normalizedUpdate: Partial<StoredEntry> = {
            ...(restUpdate as Partial<StoredEntry>),
        };

        if ("event" in restUpdate) {
            normalizedUpdate.event = (restUpdate as Partial<Entry>).event ?? "";
        }

        if ("notes" in restUpdate) {
            normalizedUpdate.notes = (restUpdate as Partial<Entry>).notes ?? "";
        }

        const updated: StoredEntry = {
            ...normalizeStoredEntry(this.store.entries[index]),
            ...normalizedUpdate,
            date:
                dateWorked ??
                (update as Partial<EntryCreateInput>).date ??
                this.store.entries[index].date,
            venue:
                "venue" in restUpdate
                    ? ((restUpdate as Partial<Entry>).venue ?? "")
                    : (this.store.entries[index].venue ?? ""),
            entryId, // prevent ID changes
            createdAt: this.store.entries[index].createdAt, // prevent creation time changes
            updatedAt: nextIsoTimestamp(this.store.entries[index].updatedAt),
        };

        if (!validateEntry(updated)) {
            return err({
                type: "validation",
                message: "Updated entry validation failed",
                field: "entry",
            });
        }

        this.store.entries[index] = updated;
        this.onMutation?.();
        return ok(toDomainEntry(updated));
    }

    async delete(entryId: Id): Promise<Result<void>> {
        const index = this.store.entries.findIndex(
            (e) => e.entryId === entryId,
        );
        if (index === -1) {
            return err({
                type: "notFound",
                entityType: "Entry",
                id: entryId,
            });
        }
        this.store.entries.splice(index, 1);
        this.onMutation?.();
        return ok(undefined);
    }
}

/**
 * OrganizationRepositoryImpl: CRUD operations for organizations
 */
class OrganizationRepositoryImpl implements IOrganizationRepository {
    constructor(
        private store: MemoryStore,
        private onMutation?: MutationCallback,
        private onRead?: () => void,
    ) {}

    async create(
        org: Omit<Organization, "organizationId" | "createdAt">,
    ): Promise<Result<Organization>> {
        const newOrg: Organization = {
            ...org,
            // Apply schema defaults for new organizations
            timezone: org.timezone ?? "UTC",
            workweekStartDay: org.workweekStartDay ?? 1,
            notes: org.notes ?? null,
            venues: org.venues ?? [],
            positions: org.positions ?? [],
            organizationId: genId("org"),
            createdAt: new Date().toISOString(),
        };

        if (!validateOrganization(newOrg)) {
            return err({
                type: "validation",
                message: "Organization validation failed",
                field: "organization",
            });
        }

        this.store.organizations.push(newOrg);
        this.onMutation?.();
        return ok(normalizeStoredOrganization(newOrg));
    }

    async get(organizationId: Id): Promise<Result<Organization>> {
        this.onRead?.();
        const org = this.store.organizations.find(
            (o) => o.organizationId === organizationId,
        );
        if (!org) {
            return err({
                type: "notFound",
                entityType: "Organization",
                id: organizationId,
            });
        }
        return ok(normalizeStoredOrganization(org));
    }

    async list(): Promise<Result<Organization[]>> {
        this.onRead?.();

        return ok(this.store.organizations.map(normalizeStoredOrganization));
    }

    async update(
        organizationId: Id,
        update: Partial<Organization>,
    ): Promise<Result<Organization>> {
        const index = this.store.organizations.findIndex(
            (o) => o.organizationId === organizationId,
        );
        if (index === -1) {
            return err({
                type: "notFound",
                entityType: "Organization",
                id: organizationId,
            });
        }

        const updated = {
            ...normalizeStoredOrganization(this.store.organizations[index]),
            ...update,
            organizationId, // prevent ID changes
            createdAt: this.store.organizations[index].createdAt, // prevent creation time changes
        };

        if (!validateOrganization(updated)) {
            return err({
                type: "validation",
                message: "Updated organization validation failed",
                field: "organization",
            });
        }

        this.store.organizations[index] = updated;
        this.onMutation?.();
        return ok(normalizeStoredOrganization(updated));
    }

    async delete(organizationId: Id): Promise<Result<void>> {
        const index = this.store.organizations.findIndex(
            (o) => o.organizationId === organizationId,
        );
        if (index === -1) {
            return err({
                type: "notFound",
                entityType: "Organization",
                id: organizationId,
            });
        }
        this.store.organizations.splice(index, 1);
        this.onMutation?.();
        return ok(undefined);
    }
}

/**
 * TagHistoryRepositoryImpl: manage tag history
 */
class TagHistoryRepositoryImpl implements ITagHistoryRepository {
    constructor(
        private store: MemoryStore,
        private onMutation?: MutationCallback,
    ) {}

    async getAll(): Promise<Result<TagHistory[]>> {
        return ok([...this.store.tags]);
    }

    async record(tag: string): Promise<Result<TagHistory>> {
        const existing = this.store.tags.find(
            (t) => t.tag.toLowerCase() === tag.toLowerCase(),
        );

        if (existing) {
            existing.count += 1;
            existing.lastUsedAt = new Date().toISOString();
            this.onMutation?.();
            return ok({ ...existing });
        }

        const newTag: TagHistory = {
            tag,
            count: 1,
            lastUsedAt: new Date().toISOString(),
        };

        if (!validateTag(newTag)) {
            return err({
                type: "validation",
                message: "Tag validation failed",
                field: "tag",
            });
        }

        this.store.tags.push(newTag);
        this.onMutation?.();
        return ok(newTag);
    }

    async get(tag: string): Promise<Result<TagHistory | null>> {
        const found = this.store.tags.find(
            (t) => t.tag.toLowerCase() === tag.toLowerCase(),
        );
        return ok(found || null);
    }
}

/**
 * PositionHistoryRepositoryImpl: manage position history
 */
class PositionHistoryRepositoryImpl implements IPositionHistoryRepository {
    constructor(
        private store: MemoryStore,
        private onMutation?: MutationCallback,
    ) {}

    async getByOrg(organizationId: Id): Promise<Result<PositionHistory[]>> {
        const positions = this.store.positions.filter(
            (p) => p.organizationId === organizationId,
        );
        return ok([...positions]);
    }

    async record(
        organizationId: Id,
        position: string,
    ): Promise<Result<PositionHistory>> {
        const existing = this.store.positions.find(
            (p) =>
                p.organizationId === organizationId &&
                p.position.toLowerCase() === position.toLowerCase(),
        );

        if (existing) {
            existing.count += 1;
            existing.lastUsedAt = new Date().toISOString();
            this.onMutation?.();
            return ok({ ...existing });
        }

        const newPosition: PositionHistory = {
            organizationId,
            position,
            count: 1,
            lastUsedAt: new Date().toISOString(),
        };

        if (!validatePosition(newPosition)) {
            return err({
                type: "validation",
                message: "Position validation failed",
                field: "position",
            });
        }

        this.store.positions.push(newPosition);
        this.onMutation?.();
        return ok(newPosition);
    }

    async get(
        organizationId: Id,
        position: string,
    ): Promise<Result<PositionHistory | null>> {
        const found = this.store.positions.find(
            (p) =>
                p.organizationId === organizationId &&
                p.position.toLowerCase() === position.toLowerCase(),
        );
        return ok(found || null);
    }
}

/**
 * VenueHistoryRepositoryImpl: manage venue history
 */
class VenueHistoryRepositoryImpl implements IVenueHistoryRepository {
    constructor(
        private store: MemoryStore,
        private onMutation?: MutationCallback,
    ) {}

    async getByOrg(organizationId: Id): Promise<Result<VenueHistory[]>> {
        const venues = this.store.venues.filter(
            (v) => v.organizationId === organizationId,
        );
        return ok([...venues]);
    }

    async record(
        organizationId: Id,
        venueName: string,
    ): Promise<Result<VenueHistory>> {
        const existing = this.store.venues.find(
            (v) =>
                v.organizationId === organizationId &&
                v.venueName.toLowerCase() === venueName.toLowerCase(),
        );

        if (existing) {
            existing.count += 1;
            existing.lastUsedAt = new Date().toISOString();
            this.onMutation?.();
            return ok({ ...existing });
        }

        const newVenue: VenueHistory = {
            organizationId,
            venueName,
            count: 1,
            lastUsedAt: new Date().toISOString(),
        };

        if (!validateVenue(newVenue)) {
            return err({
                type: "validation",
                message: "Venue validation failed",
                field: "venue",
            });
        }

        this.store.venues.push(newVenue);
        this.onMutation?.();
        return ok(newVenue);
    }

    async get(
        organizationId: Id,
        venueName: string,
    ): Promise<Result<VenueHistory | null>> {
        const found = this.store.venues.find(
            (v) =>
                v.organizationId === organizationId &&
                v.venueName.toLowerCase() === venueName.toLowerCase(),
        );
        return ok(found || null);
    }
}

/**
 * RulesetRepositoryImpl: manage pay rulesets with effective-dated history
 */
class RulesetRepositoryImpl implements IRulesetRepository {
    constructor(
        private store: MemoryStore,
        private onMutation?: MutationCallback,
    ) {}

    async create(
        ruleset: Omit<Ruleset, "rulesetId" | "createdAt">,
    ): Promise<Result<Ruleset>> {
        // Validate single OT rule constraint: no mix of daily-overtime and weekly-overtime
        const otRules = ruleset.rules.filter(
            (r) => r.type === "daily-overtime" || r.type === "weekly-overtime",
        );
        if (otRules.length > 1) {
            const hasDaily = otRules.some((r) => r.type === "daily-overtime");
            const hasWeekly = otRules.some((r) => r.type === "weekly-overtime");
            if (hasDaily && hasWeekly) {
                return err({
                    type: "conflict",
                    message:
                        "Ruleset cannot contain both daily and weekly overtime rules",
                });
            }
        }

        const now = new Date().toISOString();
        const newRuleset: Ruleset = {
            rulesetId: genId("ruleset"),
            ...ruleset,
            createdAt: now,
        };

        if (!validateRuleset(newRuleset)) {
            return err({
                type: "validation",
                message: "Ruleset validation failed",
                field: "ruleset",
            });
        }

        this.store.rulesets.push(newRuleset);
        this.onMutation?.();
        return ok(newRuleset);
    }

    async getById(rulesetId: Id): Promise<Result<Ruleset>> {
        const ruleset = this.store.rulesets.find(
            (r) => r.rulesetId === rulesetId,
        );
        if (!ruleset) {
            return err({
                type: "notFound",
                entityType: "Ruleset",
                id: rulesetId,
            });
        }
        return ok(ruleset);
    }

    async getActive(params: {
        organizationId: Id;
        onDate: string;
    }): Promise<Result<Ruleset | null>> {
        // Find all rulesets for this org with effectiveDate <= onDate, sorted by effectiveDate descending
        const candidates = this.store.rulesets
            .filter(
                (r) =>
                    r.organizationId === params.organizationId &&
                    r.effectiveDate <= params.onDate,
            )
            .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

        return ok(candidates[0] || null);
    }

    async listByOrg(organizationId: Id): Promise<Result<Ruleset[]>> {
        const rulesets = this.store.rulesets
            .filter((r) => r.organizationId === organizationId)
            .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
        return ok([...rulesets]);
    }

    async delete(rulesetId: Id): Promise<Result<void>> {
        const index = this.store.rulesets.findIndex(
            (r) => r.rulesetId === rulesetId,
        );
        if (index === -1) {
            return err({
                type: "notFound",
                entityType: "Ruleset",
                id: rulesetId,
            });
        }
        this.store.rulesets.splice(index, 1);
        this.onMutation?.();
        return ok(undefined);
    }
}

/**
 * TransactionManagerImpl: coordinate transactional operations
 */
class TransactionManagerImpl implements ITransactionManager {
    constructor(
        private store: MemoryStore,
        private getRepositories: (store: MemoryStore) => {
            entries: IEntryRepository;
            organizations: IOrganizationRepository;
            tags: ITagHistoryRepository;
            positions: IPositionHistoryRepository;
            venues: IVenueHistoryRepository;
            rulesets: IRulesetRepository;
        },
        private onCommit?: MutationCallback,
    ) {}

    async transaction<T>(
        fn: (tx: ITransactionContext) => Promise<Result<T>>,
    ): Promise<Result<T>> {
        const txStore: MemoryStore = JSON.parse(JSON.stringify(this.store));

        // Create transaction repositories
        const txRepos = this.getRepositories(txStore);

        // Create transaction context
        const tx = new TransactionContextImpl(
            txStore,
            txRepos.entries,
            txRepos.organizations,
            txRepos.tags,
            txRepos.positions,
            txRepos.venues,
            txRepos.rulesets,
        );

        // Execute transaction function
        const result = await fn(tx);

        // Check for rollback flag or error
        if (tx.isFlaggedForRollback()) {
            return err({
                type: "transaction",
                message: `Transaction rolled back: ${tx.getRollbackReason()}`,
                attempted: "transaction body",
            });
        }

        if (!result.success) {
            return result; // Return the error without committing
        }

        // Commit: copy txStore back to original store
        this.store.entries = txStore.entries;
        this.store.organizations = txStore.organizations;
        this.store.tags = txStore.tags;
        this.store.positions = txStore.positions;
        this.store.venues = txStore.venues;
        this.store.rulesets = txStore.rulesets;
        this.onCommit?.();

        return result;
    }
}

/**
 * JsonDataLayer: main entry point for JSON adapter
 */
export class JsonDataLayer implements IDataLayer {
    private store: MemoryStore = {
        entries: [],
        organizations: [],
        tags: [],
        positions: [],
        venues: [],
        rulesets: [],
    };

    entries: IEntryRepository;
    organizations: IOrganizationRepository;
    tags: ITagHistoryRepository;
    positions: IPositionHistoryRepository;
    venues: IVenueHistoryRepository;
    rulesets: IRulesetRepository;
    transaction: ITransactionManager;

    constructor() {
        // Initialize repositories with the store
        this.entries = new EntryRepositoryImpl(
            this.store,
            () => this.persistToStorage(),
            () => this.loadFromStorage(),
        );
        this.organizations = new OrganizationRepositoryImpl(
            this.store,
            () => this.persistToStorage(),
            () => this.loadFromStorage(),
        );
        this.tags = new TagHistoryRepositoryImpl(this.store, () =>
            this.persistToStorage(),
        );
        this.positions = new PositionHistoryRepositoryImpl(this.store, () =>
            this.persistToStorage(),
        );
        this.venues = new VenueHistoryRepositoryImpl(this.store, () =>
            this.persistToStorage(),
        );
        this.rulesets = new RulesetRepositoryImpl(this.store, () =>
            this.persistToStorage(),
        );

        // Initialize transaction manager
        this.transaction = new TransactionManagerImpl(
            this.store,
            (store) => ({
                entries: new EntryRepositoryImpl(store),
                organizations: new OrganizationRepositoryImpl(store),
                tags: new TagHistoryRepositoryImpl(store),
                positions: new PositionHistoryRepositoryImpl(store),
                venues: new VenueHistoryRepositoryImpl(store),
                rulesets: new RulesetRepositoryImpl(store),
            }),
            () => this.persistToStorage(),
        );

        this.loadFromStorage();
    }

    private loadFromStorage(): void {
        const storage = getStorage();

        if (!storage) {
            return;
        }

        const entriesJson = storage.getItem(ENTRIES_KEY);
        const orgsJson = storage.getItem(ORGS_KEY);
        const tagsJson = storage.getItem(TAGS_KEY);
        const positionsJson = storage.getItem(POSITIONS_KEY);
        const venuesJson = storage.getItem(VENUES_KEY);
        const rulesetsJson = storage.getItem(RULESETS_KEY);

        if (entriesJson) {
            this.store.entries =
                JSON.parse(entriesJson).map(normalizeStoredEntry);
        }
        if (orgsJson) {
            this.store.organizations = JSON.parse(orgsJson).map(
                normalizeStoredOrganization,
            );
        }
        if (tagsJson) {
            this.store.tags = JSON.parse(tagsJson);
        }
        if (positionsJson) {
            this.store.positions = JSON.parse(positionsJson);
        }
        if (venuesJson) {
            this.store.venues = JSON.parse(venuesJson);
        }
        if (rulesetsJson) {
            this.store.rulesets = JSON.parse(rulesetsJson);
        }
    }

    async initialize(): Promise<Result<void>> {
        try {
            this.loadFromStorage();

            return ok(undefined);
        } catch (error) {
            return err({
                type: "io",
                message: `Failed to initialize data layer: ${error instanceof Error ? error.message : "Unknown error"}`,
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    private persistToStorage(): void {
        const storage = getStorage();

        if (!storage) {
            return;
        }

        storage.setItem(ENTRIES_KEY, JSON.stringify(this.store.entries));
        storage.setItem(ORGS_KEY, JSON.stringify(this.store.organizations));
        storage.setItem(TAGS_KEY, JSON.stringify(this.store.tags));
        storage.setItem(POSITIONS_KEY, JSON.stringify(this.store.positions));
        storage.setItem(VENUES_KEY, JSON.stringify(this.store.venues));
        storage.setItem(RULESETS_KEY, JSON.stringify(this.store.rulesets));
    }

    async dispose(): Promise<void> {
        const storage = getStorage();

        if (storage) {
            try {
                this.persistToStorage();
            } catch (error) {
                console.error("Failed to persist data layer:", error);
            }
        }
    }
}
