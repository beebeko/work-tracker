/**
 * Zustand store for Freelance Tracker UI state management
 * Manages entries, organizations, histories, and loading/error states
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
    Entry,
    Organization,
    OrganizationPosition,
    TagHistory,
    PositionHistory,
    VenueHistory,
    Ruleset,
    Id,
    Result,
    DalError,
} from "@/features/freelance-tracker/contracts/types";
import { getDataLayer } from "@/features/freelance-tracker/data";

const dalErrorMessage = (error: DalError): string =>
    error.type === "notFound" ? `${error.entityType} not found` : error.message;

const normalizeOrganizationName = (value: string): string =>
    value.trim().replace(/\s+/g, " ").toLowerCase();

const normalizeCatalogName = (value: string): string =>
    value.trim().replace(/\s+/g, " ");

const normalizeCatalogKey = (value: string): string =>
    normalizeCatalogName(value).toLowerCase();

const normalizeOrganizationCatalogs = (
    organization: Organization,
): Organization => ({
    ...organization,
    venues: organization.venues,
    positions: organization.positions,
});

const upsertOrganizationVenue = (
    organization: Organization,
    venueName: string,
): { organization: Organization; changed: boolean } => {
    const normalizedVenueName = normalizeCatalogName(venueName);
    if (!normalizedVenueName) {
        return {
            organization: normalizeOrganizationCatalogs(organization),
            changed: false,
        };
    }

    const nextOrganization = normalizeOrganizationCatalogs(organization);
    const hasVenue = nextOrganization.venues.some(
        (venue) =>
            normalizeCatalogKey(venue) ===
            normalizeCatalogKey(normalizedVenueName),
    );

    if (hasVenue) {
        return {
            organization: nextOrganization,
            changed: false,
        };
    }

    return {
        organization: {
            ...nextOrganization,
            venues: [...nextOrganization.venues, normalizedVenueName],
        },
        changed: true,
    };
};

const upsertOrganizationPosition = (
    organization: Organization,
    positionName: string,
    defaultRate?: number | null,
): { organization: Organization; changed: boolean } => {
    const normalizedPositionName = normalizeCatalogName(positionName);
    const normalizedOrganization = normalizeOrganizationCatalogs(organization);

    if (!normalizedPositionName) {
        return {
            organization: normalizedOrganization,
            changed: false,
        };
    }

    const nextDefaultRate =
        typeof defaultRate === "number" && Number.isFinite(defaultRate)
            ? defaultRate
            : defaultRate === null
              ? null
              : undefined;

    const existingIndex = normalizedOrganization.positions.findIndex(
        (position) =>
            normalizeCatalogKey(position.name) ===
            normalizeCatalogKey(normalizedPositionName),
    );

    if (existingIndex === -1) {
        const nextPosition: OrganizationPosition = {
            name: normalizedPositionName,
        };

        if (nextDefaultRate !== undefined) {
            nextPosition.defaultRate = nextDefaultRate;
        }

        return {
            organization: {
                ...normalizedOrganization,
                positions: [...normalizedOrganization.positions, nextPosition],
            },
            changed: true,
        };
    }

    const existingPosition = normalizedOrganization.positions[existingIndex];
    if (
        nextDefaultRate === undefined ||
        existingPosition.defaultRate === nextDefaultRate
    ) {
        return {
            organization: normalizedOrganization,
            changed: false,
        };
    }

    const nextPositions = [...normalizedOrganization.positions];
    nextPositions[existingIndex] = {
        ...existingPosition,
        name: normalizedPositionName,
        defaultRate: nextDefaultRate,
    };

    return {
        organization: {
            ...normalizedOrganization,
            positions: nextPositions,
        },
        changed: true,
    };
};

export interface FreelanceTrackerStore {
    // --- Data State ---
    entries: Entry[];
    organizations: Organization[];
    selectedPeriod: { startDate: string; endDate: string } | null;
    tagHistories: TagHistory[];
    positionHistories: PositionHistory[];
    venueHistories: VenueHistory[];
    rulesets: Ruleset[];

    // --- UI State ---
    loading: boolean;
    error: string | null;
    isFormOpen: boolean;
    editingEntryId: Id | null;

    // --- Actions ---
    loadOrganizations(): Promise<void>;
    loadEntries(
        orgId: Id,
        period: { startDate: string; endDate: string },
    ): Promise<void>;
    loadHistories(orgId: Id): Promise<void>;
    createEntry(
        entry: Omit<Entry, "entryId" | "createdAt" | "updatedAt">,
    ): Promise<Result<Entry>>;
    createOrganization(input: {
        name: string;
        payPeriodStartDay: number;
        timezone?: string;
        workweekStartDay?: number;
        notes?: string | null;
    }): Promise<Result<Organization>>;
    createOrganizationPosition(input: {
        organizationId: Id;
        position: string;
        defaultRate?: number | null;
    }): Promise<Result<Organization>>;
    updateEntry(entryId: Id, updates: Partial<Entry>): Promise<Result<Entry>>;
    deleteEntry(entryId: Id): Promise<Result<void>>;
    selectPeriod(startDate: string, endDate: string): void;
    setFormOpen(isOpen: boolean): void;
    setEditingEntry(entryId: Id | null): void;
    setError(error: string | null): void;
    updateOrganization(
        orgId: Id,
        update: Partial<Omit<Organization, "organizationId" | "createdAt">>,
    ): Promise<Result<Organization>>;
    loadRulesets(orgId: Id): Promise<void>;
    createRuleset(
        input: Omit<Ruleset, "rulesetId" | "createdAt">,
    ): Promise<Result<Ruleset>>;
    deleteRuleset(rulesetId: Id): Promise<Result<void>>;
    deleteOrganization(organizationId: Id): Promise<Result<void>>;
}

const useFreelanceTrackerStore = create<FreelanceTrackerStore>()(
    immer((set, get) => {
        const dal = getDataLayer();

        return {
            // --- Initial State ---
            entries: [],
            organizations: [],
            selectedPeriod: null,
            tagHistories: [],
            positionHistories: [],
            venueHistories: [],
            rulesets: [],
            loading: false,
            error: null,
            isFormOpen: false,
            editingEntryId: null,

            // --- Actions ---

            async loadOrganizations() {
                set((state) => {
                    state.loading = true;
                    state.error = null;
                });

                try {
                    const result = await dal.organizations.list();
                    if (result.success) {
                        let organizations = result.data;

                        if (organizations.length === 0) {
                            const createResult = await dal.organizations.create(
                                {
                                    name: "Default Organization",
                                    payPeriodStartDay: 1,
                                    timezone: "UTC",
                                    workweekStartDay: 1,
                                    notes: null,
                                    venues: [],
                                    positions: [],
                                },
                            );

                            if (!createResult.success) {
                                set((state) => {
                                    state.error = dalErrorMessage(
                                        createResult.error,
                                    );
                                });
                                return;
                            }

                            organizations = [createResult.data];
                        }

                        set((state) => {
                            state.organizations = organizations.map(
                                normalizeOrganizationCatalogs,
                            );
                        });
                    } else {
                        set((state) => {
                            state.error = dalErrorMessage(result.error);
                        });
                    }
                } catch (e) {
                    set((state) => {
                        state.error =
                            e instanceof Error ? e.message : String(e);
                    });
                } finally {
                    set((state) => {
                        state.loading = false;
                    });
                }
            },

            async loadEntries(orgId, period) {
                set((state) => {
                    state.loading = true;
                    state.error = null;
                });

                try {
                    const result = await dal.entries.list({
                        organizationId: orgId,
                        startDate: period.startDate,
                        endDate: period.endDate,
                    });

                    if (result.success) {
                        set((state) => {
                            state.entries = result.data;
                        });
                    } else {
                        set((state) => {
                            state.error = dalErrorMessage(result.error);
                        });
                    }
                } catch (e) {
                    set((state) => {
                        state.error =
                            e instanceof Error ? e.message : String(e);
                    });
                } finally {
                    set((state) => {
                        state.loading = false;
                    });
                }
            },

            async loadHistories(orgId) {
                set((state) => {
                    state.loading = true;
                    state.error = null;
                });

                try {
                    const [tagsResult, positionsResult, venuesResult] =
                        await Promise.all([
                            dal.tags.getAll(),
                            dal.positions.getByOrg(orgId),
                            dal.venues.getByOrg(orgId),
                        ]);

                    if (
                        tagsResult.success &&
                        positionsResult.success &&
                        venuesResult.success
                    ) {
                        set((state) => {
                            state.tagHistories = tagsResult.data;
                            state.positionHistories = positionsResult.data;
                            state.venueHistories = venuesResult.data;
                        });
                    } else {
                        const firstError = !tagsResult.success
                            ? tagsResult.error
                            : !positionsResult.success
                              ? positionsResult.error
                              : !venuesResult.success
                                ? venuesResult.error
                                : null;
                        if (firstError) {
                            set((state) => {
                                state.error = dalErrorMessage(firstError);
                            });
                        }
                    }
                } catch (e) {
                    set((state) => {
                        state.error =
                            e instanceof Error ? e.message : String(e);
                    });
                } finally {
                    set((state) => {
                        state.loading = false;
                    });
                }
            },

            async createEntry(entry) {
                set((state) => {
                    state.loading = true;
                    state.error = null;
                });

                try {
                    const result = await dal.transaction.transaction(
                        async (tx) => {
                            const createResult = await tx.entries.create({
                                ...entry,
                                position: normalizeCatalogName(entry.position),
                                venue:
                                    normalizeCatalogName(entry.venue ?? "") ||
                                    null,
                            });

                            if (!createResult.success) {
                                return createResult;
                            }

                            const createdEntry = createResult.data;

                            for (const tag of createdEntry.tags) {
                                const tagResult = await tx.tags.record(tag);
                                if (!tagResult.success) {
                                    return tagResult;
                                }
                            }

                            const positionResult = await tx.positions.record(
                                createdEntry.organizationId,
                                createdEntry.position,
                            );
                            if (!positionResult.success) {
                                return positionResult;
                            }

                            if (createdEntry.venue?.trim()) {
                                const venueResult = await tx.venues.record(
                                    createdEntry.organizationId,
                                    createdEntry.venue,
                                );
                                if (!venueResult.success) {
                                    return venueResult;
                                }
                            }

                            const organizationResult =
                                await tx.organizations.get(
                                    createdEntry.organizationId,
                                );
                            if (!organizationResult.success) {
                                return organizationResult;
                            }

                            let nextOrganization = organizationResult.data;
                            let catalogChanged = false;

                            const positionCatalogUpdate =
                                upsertOrganizationPosition(
                                    nextOrganization,
                                    createdEntry.position,
                                );
                            nextOrganization =
                                positionCatalogUpdate.organization;
                            catalogChanged ||= positionCatalogUpdate.changed;

                            if (createdEntry.venue?.trim()) {
                                const venueCatalogUpdate =
                                    upsertOrganizationVenue(
                                        nextOrganization,
                                        createdEntry.venue,
                                    );
                                nextOrganization =
                                    venueCatalogUpdate.organization;
                                catalogChanged ||= venueCatalogUpdate.changed;
                            }

                            if (catalogChanged) {
                                const updateOrganizationResult =
                                    await tx.organizations.update(
                                        createdEntry.organizationId,
                                        {
                                            venues: nextOrganization.venues,
                                            positions:
                                                nextOrganization.positions,
                                        },
                                    );

                                if (!updateOrganizationResult.success) {
                                    return updateOrganizationResult;
                                }
                            }

                            return createResult;
                        },
                    );

                    if (result.success) {
                        set((state) => {
                            state.entries.push(result.data);
                            const organizationIndex =
                                state.organizations.findIndex(
                                    (organization) =>
                                        organization.organizationId ===
                                        result.data.organizationId,
                                );

                            if (organizationIndex >= 0) {
                                let nextOrganization =
                                    state.organizations[organizationIndex];
                                const positionCatalogUpdate =
                                    upsertOrganizationPosition(
                                        nextOrganization,
                                        result.data.position,
                                    );
                                nextOrganization =
                                    positionCatalogUpdate.organization;

                                if (result.data.venue?.trim()) {
                                    nextOrganization = upsertOrganizationVenue(
                                        nextOrganization,
                                        result.data.venue,
                                    ).organization;
                                }

                                state.organizations[organizationIndex] =
                                    nextOrganization;
                            }

                            const positionHistoryIndex =
                                state.positionHistories.findIndex(
                                    (positionHistory) =>
                                        positionHistory.organizationId ===
                                            result.data.organizationId &&
                                        normalizeCatalogKey(
                                            positionHistory.position,
                                        ) ===
                                            normalizeCatalogKey(
                                                result.data.position,
                                            ),
                                );

                            if (positionHistoryIndex >= 0) {
                                state.positionHistories[positionHistoryIndex] =
                                    {
                                        ...state.positionHistories[
                                            positionHistoryIndex
                                        ],
                                        count:
                                            state.positionHistories[
                                                positionHistoryIndex
                                            ].count + 1,
                                        lastUsedAt: result.data.updatedAt,
                                    };
                            } else {
                                state.positionHistories.push({
                                    organizationId: result.data.organizationId,
                                    position: result.data.position,
                                    count: 1,
                                    lastUsedAt: result.data.updatedAt,
                                });
                            }

                            if (result.data.venue?.trim()) {
                                const venueHistoryIndex =
                                    state.venueHistories.findIndex(
                                        (venueHistory) =>
                                            venueHistory.organizationId ===
                                                result.data.organizationId &&
                                            normalizeCatalogKey(
                                                venueHistory.venueName,
                                            ) ===
                                                normalizeCatalogKey(
                                                    result.data.venue ?? "",
                                                ),
                                    );

                                if (venueHistoryIndex >= 0) {
                                    state.venueHistories[venueHistoryIndex] = {
                                        ...state.venueHistories[
                                            venueHistoryIndex
                                        ],
                                        count:
                                            state.venueHistories[
                                                venueHistoryIndex
                                            ].count + 1,
                                        lastUsedAt: result.data.updatedAt,
                                    };
                                } else {
                                    state.venueHistories.push({
                                        organizationId:
                                            result.data.organizationId,
                                        venueName: result.data.venue,
                                        count: 1,
                                        lastUsedAt: result.data.updatedAt,
                                    });
                                }
                            }

                            state.isFormOpen = false;
                            state.editingEntryId = null;
                        });
                    } else {
                        set((state) => {
                            state.error = dalErrorMessage(result.error);
                        });
                    }
                    return result;
                } finally {
                    set((state) => {
                        state.loading = false;
                    });
                }
            },

            async createOrganization(input) {
                set((state) => {
                    state.loading = true;
                    state.error = null;
                });

                const normalizedInputName = normalizeOrganizationName(
                    input.name,
                );

                if (!normalizedInputName) {
                    const validationError: DalError = {
                        type: "validation",
                        field: "name",
                        message: "Organization name is required",
                    };

                    set((state) => {
                        state.error = validationError.message;
                        state.loading = false;
                    });

                    return {
                        success: false,
                        error: validationError,
                    };
                }

                try {
                    const stateOrgMatch = get().organizations.find(
                        (org) =>
                            normalizeOrganizationName(org.name) ===
                            normalizedInputName,
                    );

                    if (stateOrgMatch) {
                        return { success: true, data: stateOrgMatch };
                    }

                    const listResult = await dal.organizations.list();
                    if (!listResult.success) {
                        set((state) => {
                            state.error = dalErrorMessage(listResult.error);
                        });
                        return listResult;
                    }

                    const normalizedOrgs = listResult.data;
                    const existingOrg = normalizedOrgs.find(
                        (org) =>
                            normalizeOrganizationName(org.name) ===
                            normalizedInputName,
                    );

                    if (existingOrg) {
                        set((state) => {
                            state.organizations = normalizedOrgs;
                        });
                        return { success: true, data: existingOrg };
                    }

                    const createResult = await dal.organizations.create({
                        name: input.name.trim().replace(/\s+/g, " "),
                        payPeriodStartDay: input.payPeriodStartDay,
                        timezone: input.timezone ?? "UTC",
                        workweekStartDay: input.workweekStartDay ?? 1,
                        notes: input.notes ?? null,
                        venues: [],
                        positions: [],
                    });

                    if (!createResult.success) {
                        set((state) => {
                            state.error = dalErrorMessage(createResult.error);
                        });
                        return createResult;
                    }

                    set((state) => {
                        state.organizations = [
                            ...normalizedOrgs.map(
                                normalizeOrganizationCatalogs,
                            ),
                            normalizeOrganizationCatalogs(createResult.data),
                        ];
                    });

                    return createResult;
                } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    const ioError: DalError = {
                        type: "io",
                        message,
                    };

                    set((state) => {
                        state.error = message;
                    });

                    return {
                        success: false,
                        error: ioError,
                    };
                } finally {
                    set((state) => {
                        state.loading = false;
                    });
                }
            },

            async updateEntry(entryId, updates) {
                set((state) => {
                    state.loading = true;
                    state.error = null;
                });

                try {
                    const currentEntryResult =
                        await dal.entries.getById(entryId);
                    if (!currentEntryResult.success) {
                        set((state) => {
                            state.error = dalErrorMessage(
                                currentEntryResult.error,
                            );
                        });
                        return currentEntryResult;
                    }

                    const result = await dal.transaction.transaction(
                        async (tx) => {
                            const updateResult = await tx.entries.update(
                                entryId,
                                {
                                    ...updates,
                                    position:
                                        typeof updates.position === "string"
                                            ? normalizeCatalogName(
                                                  updates.position,
                                              )
                                            : updates.position,
                                    venue:
                                        typeof updates.venue === "string"
                                            ? normalizeCatalogName(
                                                  updates.venue,
                                              ) || null
                                            : updates.venue,
                                },
                            );

                            if (!updateResult.success) {
                                return updateResult;
                            }

                            const updatedEntry = updateResult.data;

                            for (const tag of updatedEntry.tags) {
                                const tagResult = await tx.tags.record(tag);
                                if (!tagResult.success) {
                                    return tagResult;
                                }
                            }

                            const positionResult = await tx.positions.record(
                                updatedEntry.organizationId,
                                updatedEntry.position,
                            );
                            if (!positionResult.success) {
                                return positionResult;
                            }

                            if (updatedEntry.venue?.trim()) {
                                const venueResult = await tx.venues.record(
                                    updatedEntry.organizationId,
                                    updatedEntry.venue,
                                );
                                if (!venueResult.success) {
                                    return venueResult;
                                }
                            }

                            const organizationResult =
                                await tx.organizations.get(
                                    updatedEntry.organizationId,
                                );
                            if (!organizationResult.success) {
                                return organizationResult;
                            }

                            let nextOrganization = organizationResult.data;
                            let catalogChanged = false;

                            const positionCatalogUpdate =
                                upsertOrganizationPosition(
                                    nextOrganization,
                                    updatedEntry.position,
                                );
                            nextOrganization =
                                positionCatalogUpdate.organization;
                            catalogChanged ||= positionCatalogUpdate.changed;

                            if (updatedEntry.venue?.trim()) {
                                const venueCatalogUpdate =
                                    upsertOrganizationVenue(
                                        nextOrganization,
                                        updatedEntry.venue,
                                    );
                                nextOrganization =
                                    venueCatalogUpdate.organization;
                                catalogChanged ||= venueCatalogUpdate.changed;
                            }

                            if (catalogChanged) {
                                const updateOrganizationResult =
                                    await tx.organizations.update(
                                        updatedEntry.organizationId,
                                        {
                                            venues: nextOrganization.venues,
                                            positions:
                                                nextOrganization.positions,
                                        },
                                    );

                                if (!updateOrganizationResult.success) {
                                    return updateOrganizationResult;
                                }
                            }

                            return updateResult;
                        },
                    );

                    if (result.success) {
                        set((state) => {
                            const idx = state.entries.findIndex(
                                (e) => e.entryId === entryId,
                            );
                            if (idx >= 0) {
                                state.entries[idx] = result.data;
                            }

                            const organizationIndex =
                                state.organizations.findIndex(
                                    (organization) =>
                                        organization.organizationId ===
                                        result.data.organizationId,
                                );

                            if (organizationIndex >= 0) {
                                let nextOrganization =
                                    state.organizations[organizationIndex];
                                const positionCatalogUpdate =
                                    upsertOrganizationPosition(
                                        nextOrganization,
                                        result.data.position,
                                    );
                                nextOrganization =
                                    positionCatalogUpdate.organization;

                                if (result.data.venue?.trim()) {
                                    nextOrganization = upsertOrganizationVenue(
                                        nextOrganization,
                                        result.data.venue,
                                    ).organization;
                                }

                                state.organizations[organizationIndex] =
                                    nextOrganization;
                            }

                            state.editingEntryId = null;
                        });
                    } else {
                        set((state) => {
                            state.error = dalErrorMessage(result.error);
                        });
                    }
                    return result;
                } finally {
                    set((state) => {
                        state.loading = false;
                    });
                }
            },

            async deleteEntry(entryId) {
                set((state) => {
                    state.loading = true;
                    state.error = null;
                });

                try {
                    const result = await dal.entries.delete(entryId);
                    if (result.success) {
                        set((state) => {
                            state.entries = state.entries.filter(
                                (e) => e.entryId !== entryId,
                            );
                        });
                    } else {
                        set((state) => {
                            state.error = dalErrorMessage(result.error);
                        });
                    }
                    return result;
                } finally {
                    set((state) => {
                        state.loading = false;
                    });
                }
            },

            selectPeriod(startDate, endDate) {
                set((state) => {
                    state.selectedPeriod = { startDate, endDate };
                });
            },

            setFormOpen(isOpen) {
                set((state) => {
                    state.isFormOpen = isOpen;
                    if (!isOpen) {
                        state.editingEntryId = null;
                    }
                });
            },

            setEditingEntry(entryId) {
                set((state) => {
                    state.editingEntryId = entryId;
                    if (entryId) {
                        state.isFormOpen = true;
                    }
                });
            },

            setError(error) {
                set((state) => {
                    state.error = error;
                });
            },

            async updateOrganization(orgId, update) {
                const result = await dal.organizations.update(orgId, update);
                if (result.success) {
                    set((state) => {
                        const idx = state.organizations.findIndex(
                            (o) => o.organizationId === orgId,
                        );
                        if (idx >= 0) {
                            state.organizations[idx] =
                                normalizeOrganizationCatalogs(result.data);
                        }
                    });
                }
                return result;
            },

            async createOrganizationPosition(input) {
                set((state) => {
                    state.loading = true;
                    state.error = null;
                });

                const normalizedPosition = normalizeCatalogName(input.position);
                if (!normalizedPosition) {
                    const validationError: DalError = {
                        type: "validation",
                        field: "position",
                        message: "Position name is required",
                    };

                    set((state) => {
                        state.error = validationError.message;
                        state.loading = false;
                    });

                    return {
                        success: false,
                        error: validationError,
                    };
                }

                try {
                    const organizationResult = await dal.organizations.get(
                        input.organizationId,
                    );

                    if (!organizationResult.success) {
                        set((state) => {
                            state.error = dalErrorMessage(
                                organizationResult.error,
                            );
                        });

                        return organizationResult;
                    }

                    const nextOrganization = upsertOrganizationPosition(
                        organizationResult.data,
                        normalizedPosition,
                        input.defaultRate,
                    ).organization;

                    const result = await dal.organizations.update(
                        input.organizationId,
                        {
                            positions: nextOrganization.positions,
                        },
                    );

                    if (result.success) {
                        set((state) => {
                            const idx = state.organizations.findIndex(
                                (organization) =>
                                    organization.organizationId ===
                                    input.organizationId,
                            );
                            if (idx >= 0) {
                                state.organizations[idx] =
                                    normalizeOrganizationCatalogs(result.data);
                            }
                        });
                    } else {
                        set((state) => {
                            state.error = dalErrorMessage(result.error);
                        });
                    }

                    return result;
                } finally {
                    set((state) => {
                        state.loading = false;
                    });
                }
            },

            async loadRulesets(orgId) {
                const result = await dal.rulesets.listByOrg(orgId);
                if (result.success) {
                    set((state) => {
                        state.rulesets = result.data;
                    });
                }
            },

            async createRuleset(input) {
                const result = await dal.rulesets.create(input);
                if (result.success) {
                    set((state) => {
                        state.rulesets = [result.data, ...state.rulesets];
                    });
                }
                return result;
            },

            async deleteRuleset(rulesetId) {
                const result = await dal.rulesets.delete(rulesetId);
                if (result.success) {
                    set((state) => {
                        state.rulesets = state.rulesets.filter(
                            (ruleset) => ruleset.rulesetId !== rulesetId,
                        );
                    });
                }
                return result;
            },

            async deleteOrganization(organizationId) {
                set((state) => {
                    state.loading = true;
                    state.error = null;
                });

                try {
                    // Delete all associated rulesets
                    const rulesetResult =
                        await dal.rulesets.listByOrg(organizationId);
                    if (rulesetResult.success) {
                        await Promise.all(
                            rulesetResult.data.map((ruleset) =>
                                dal.rulesets.delete(ruleset.rulesetId),
                            ),
                        );
                    }

                    // Delete all associated entries
                    const allEntries = get().entries;
                    const entriesToDelete = allEntries.filter(
                        (e) => e.organizationId === organizationId,
                    );
                    await Promise.all(
                        entriesToDelete.map((entry) =>
                            dal.entries.delete(entry.entryId),
                        ),
                    );

                    // Delete the organization itself
                    const result =
                        await dal.organizations.delete(organizationId);

                    if (result.success) {
                        set((state) => {
                            state.organizations = state.organizations.filter(
                                (org) => org.organizationId !== organizationId,
                            );
                            state.rulesets = state.rulesets.filter(
                                (ruleset) =>
                                    ruleset.organizationId !== organizationId,
                            );
                            state.entries = state.entries.filter(
                                (entry) =>
                                    entry.organizationId !== organizationId,
                            );
                        });
                    } else {
                        set((state) => {
                            state.error = dalErrorMessage(result.error);
                        });
                    }

                    return result;
                } catch (e) {
                    const error = e instanceof Error ? e.message : String(e);
                    set((state) => {
                        state.error = error;
                    });
                    return {
                        success: false,
                        error: {
                            type: "io" as const,
                            message: error,
                        },
                    };
                } finally {
                    set((state) => {
                        state.loading = false;
                    });
                }
            },
        };
    }),
);

export default useFreelanceTrackerStore;
