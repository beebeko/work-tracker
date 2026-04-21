/**
 * Data Access Layer (DAL) repository contracts
 * These interfaces are datastore-agnostic and must be implemented by adapters
 */

import type {
    Entry,
    CreateOrganizationInput,
    Organization,
    TagHistory,
    PositionHistory,
    VenueHistory,
    Ruleset,
    CreateRulesetInput,
    Id,
    Result,
    DalError,
} from "../contracts/types";

/**
 * EntryRepository: manage work entry records
 */
export interface IEntryRepository {
    /**
     * Create a new entry and learn from new tags/positions/venues
     * Transaction: create entry + update histories atomically
     */
    create(
        entry: Omit<Entry, "entryId" | "createdAt" | "updatedAt">,
    ): Promise<Result<Entry>>;

    /**
     * Get entries for an organization within a date range
     */
    list(params: {
        organizationId: Id;
        startDate: string; // YYYY-MM-DD
        endDate: string; // YYYY-MM-DD
    }): Promise<Result<Entry[]>>;

    /**
     * Get a single entry by ID
     */
    getById(entryId: Id): Promise<Result<Entry>>;

    /**
     * Update an entry (rate, notes, tags are most common)
     */
    update(entryId: Id, update: Partial<Entry>): Promise<Result<Entry>>;

    /**
     * Delete an entry
     */
    delete(entryId: Id): Promise<Result<void>>;
}

/**
 * OrganizationRepository: manage organizations (venues/clients)
 */
export interface IOrganizationRepository {
    /**
     * Create a new organization
     */
    create(org: CreateOrganizationInput): Promise<Result<Organization>>;

    /**
     * Get organization by ID
     */
    get(organizationId: Id): Promise<Result<Organization>>;

    /**
     * List all organizations
     */
    list(): Promise<Result<Organization[]>>;

    /**
     * Update organization (e.g., payPeriodStartDay)
     */
    update(
        organizationId: Id,
        update: Partial<Organization>,
    ): Promise<Result<Organization>>;

    /**
     * Delete organization
     */
    delete(organizationId: Id): Promise<Result<void>>;
}

/**
 * TagHistoryRepository: manage learned tags
 */
export interface ITagHistoryRepository {
    /**
     * Get all unique tags in history (for autocomplete)
     */
    getAll(): Promise<Result<TagHistory[]>>;

    /**
     * Record or update a tag (idempotent if already exists)
     */
    record(tag: string): Promise<Result<TagHistory>>;

    /**
     * Get a specific tag record
     */
    get(tag: string): Promise<Result<TagHistory | null>>;
}

/**
 * PositionHistoryRepository: manage learned positions per organization
 */
export interface IPositionHistoryRepository {
    /**
     * Get all positions for an organization (for autocomplete)
     */
    getByOrg(organizationId: Id): Promise<Result<PositionHistory[]>>;

    /**
     * Record or update a position for an organization (idempotent)
     */
    record(
        organizationId: Id,
        position: string,
    ): Promise<Result<PositionHistory>>;

    /**
     * Get a specific position record
     */
    get(
        organizationId: Id,
        position: string,
    ): Promise<Result<PositionHistory | null>>;
}

/**
 * VenueHistoryRepository: manage learned venues per organization
 */
export interface IVenueHistoryRepository {
    /**
     * Get all venues for an organization (for autocomplete)
     */
    getByOrg(organizationId: Id): Promise<Result<VenueHistory[]>>;

    /**
     * Record or update a venue for an organization (idempotent)
     */
    record(
        organizationId: Id,
        venueName: string,
    ): Promise<Result<VenueHistory>>;

    /**
     * Get a specific venue record
     */
    get(
        organizationId: Id,
        venueName: string,
    ): Promise<Result<VenueHistory | null>>;
}

/**
 * RulesetRepository: manage pay rulesets with effective-dated history
 */
export interface IRulesetRepository {
    /**
     * Create a new ruleset (effective-dated, immutable once created)
     * Validates single OT rule constraint: no mix of daily and weekly OT in same ruleset
     */
    create(ruleset: CreateRulesetInput): Promise<Result<Ruleset>>;

    /**
     * Get ruleset by ID
     */
    getById(rulesetId: Id): Promise<Result<Ruleset>>;

    /**
     * Get the active ruleset for an organization on a given date
     * Returns the ruleset with the latest effectiveDate <= the given date
     */
    getActive(params: {
        organizationId: Id;
        onDate: string; // YYYY-MM-DD
    }): Promise<Result<Ruleset | null>>;

    /**
     * List all rulesets for an organization (in effective date order, newest first)
     */
    listByOrg(organizationId: Id): Promise<Result<Ruleset[]>>;

    /**
     * List all shared rulesets (in effective date order, newest first)
     * Used by selection/assignment UIs before organization association updates.
     */
    listAll(): Promise<Result<Ruleset[]>>;

    /**
     * Delete a ruleset (removes from history, use with caution)
     */
    delete(rulesetId: Id): Promise<Result<void>>;
}

/**
 * TransactionManager: coordinate multi-entity operations atomically
 */
export interface ITransactionManager {
    /**
     * Run a function within a transaction context
     * All DAL operations within the function share the transaction
     * On success, all changes are committed; on error, all rolled back
     */
    transaction<T>(
        fn: (tx: ITransactionContext) => Promise<Result<T>>,
    ): Promise<Result<T>>;
}

/**
 * TransactionContext: provided to transaction functions
 * Allows coordinated access to repositories within a single transaction
 */
export interface ITransactionContext {
    entries: IEntryRepository;
    organizations: IOrganizationRepository;
    tags: ITagHistoryRepository;
    positions: IPositionHistoryRepository;
    venues: IVenueHistoryRepository;
    rulesets: IRulesetRepository;

    /**
     * Explicitly mark transaction for rollback (can be called during execution)
     */
    rollback(reason: string): void;
}

/**
 * DataLayer: main entry point for all DAL access
 * Coordinates repositories and transactions
 */
export interface IDataLayer {
    entries: IEntryRepository;
    organizations: IOrganizationRepository;
    tags: ITagHistoryRepository;
    positions: IPositionHistoryRepository;
    venues: IVenueHistoryRepository;
    rulesets: IRulesetRepository;
    transaction: ITransactionManager;

    /**
     * Initialize the data layer (create files, schemas, etc.)
     */
    initialize(): Promise<Result<void>>;

    /**
     * Clean up resources if needed
     */
    dispose(): Promise<void>;
}
