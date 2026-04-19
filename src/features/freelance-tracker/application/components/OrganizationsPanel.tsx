import { useMemo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useFreelanceTracker } from "../hooks";
import type {
    DalError,
    Id,
    Organization,
    OrganizationPosition,
} from "@/features/freelance-tracker/contracts/types";
import { RulesetEditor } from "./RulesetEditor";
import "./OrganizationsPanel.css";

const normalizeCatalogName = (value: string): string =>
    value.trim().replace(/\s+/g, " ");

const normalizeCatalogKey = (value: string): string =>
    normalizeCatalogName(value).toLowerCase();

const weekdayOptions = [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
    { value: 7, label: "Sunday" },
] as const;

type OrganizationDraft = {
    timezone: string;
    payPeriodStartDay: number;
    workweekStartDay: number;
    notes: string;
    venues: string[];
    positions: OrganizationPosition[];
};

const createOrganizationDraft = (
    organization: Organization,
): OrganizationDraft => ({
    timezone: organization.timezone,
    payPeriodStartDay: organization.payPeriodStartDay,
    workweekStartDay: organization.workweekStartDay,
    notes: organization.notes ?? "",
    venues: [...(organization.venues ?? [])],
    positions: [...(organization.positions ?? [])],
});

const getDalErrorMessage = (error: DalError, fallback: string): string => {
    if (error.type === "notFound") {
        return fallback;
    }

    return error.message;
};

export const OrganizationsPanel: React.FC = () => {
    const store = useFreelanceTracker();
    const [selectedOrganizationId, setSelectedOrganizationId] =
        useState<Id | null>(null);
    const [notesMode, setNotesMode] = useState<"view" | "edit">("view");
    const [deleteOrgConfirmId, setDeleteOrgConfirmId] = useState<Id | null>(
        null,
    );
    const [isDeletingOrg, setIsDeletingOrg] = useState(false);
    const [draft, setDraft] = useState<OrganizationDraft | null>(null);
    const [organizationError, setOrganizationError] = useState<string | null>(
        null,
    );
    const [isSavingOrganization, setIsSavingOrganization] = useState(false);
    const [newVenueName, setNewVenueName] = useState("");
    const [newPositionName, setNewPositionName] = useState("");
    const [newPositionDefaultRate, setNewPositionDefaultRate] = useState("");
    const [positionFormOpen, setPositionFormOpen] = useState(false);
    const [editingPositionOriginalName, setEditingPositionOriginalName] =
        useState<string | null>(null);
    const [venueFormOpen, setVenueFormOpen] = useState(false);
    const [editingVenueOriginalName, setEditingVenueOriginalName] = useState<
        string | null
    >(null);

    const selectedOrganization = useMemo(
        () =>
            store.organizations.find(
                (organization) =>
                    organization.organizationId === selectedOrganizationId,
            ) ?? null,
        [store.organizations, selectedOrganizationId],
    );

    useEffect(() => {
        if (!selectedOrganization) {
            setDraft(null);
            setNotesMode("view");
            setOrganizationError(null);
            setNewVenueName("");
            setNewPositionName("");
            setNewPositionDefaultRate("");
            return;
        }

        setDraft(createOrganizationDraft(selectedOrganization));
        setNotesMode("view");
        setOrganizationError(null);
        setNewVenueName("");
        setNewPositionName("");
        setNewPositionDefaultRate("");
        setPositionFormOpen(false);
        setEditingPositionOriginalName(null);
        setVenueFormOpen(false);
        setEditingVenueOriginalName(null);
    }, [selectedOrganization]);

    // Handle escape key to close modals
    useEffect(() => {
        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (deleteOrgConfirmId) {
                    setDeleteOrgConfirmId(null);
                } else if (selectedOrganizationId) {
                    closeOrganizationModal();
                }
            }
        };

        if (selectedOrganizationId || deleteOrgConfirmId) {
            document.addEventListener("keydown", handleEscapeKey);
            return () => {
                document.removeEventListener("keydown", handleEscapeKey);
            };
        }
    }, [selectedOrganizationId, deleteOrgConfirmId]);

    const closeOrganizationModal = () => {
        setSelectedOrganizationId(null);
        setDeleteOrgConfirmId(null);
        setDraft(null);
        setNotesMode("view");
        setOrganizationError(null);
        setNewVenueName("");
        setNewPositionName("");
        setNewPositionDefaultRate("");
        setPositionFormOpen(false);
        setEditingPositionOriginalName(null);
        setVenueFormOpen(false);
        setEditingVenueOriginalName(null);
    };

    const openOrganizationModal = async (organizationId: Id) => {
        setSelectedOrganizationId(organizationId);
        setDeleteOrgConfirmId(null);
        await Promise.all([
            store.loadRulesets(organizationId),
            store.loadHistories(organizationId),
        ]);
    };

    const handleDeleteOrganization = async () => {
        if (!deleteOrgConfirmId) {
            return;
        }

        setIsDeletingOrg(true);
        try {
            const result = await store.deleteOrganization(deleteOrgConfirmId);
            if (result.success) {
                closeOrganizationModal();
            }
        } finally {
            setIsDeletingOrg(false);
        }
    };

    const handleDraftValueChange = <K extends keyof OrganizationDraft>(
        field: K,
        value: OrganizationDraft[K],
    ) => {
        setDraft((currentDraft) =>
            currentDraft ? { ...currentDraft, [field]: value } : currentDraft,
        );
        setOrganizationError(null);
    };

    const handleAddVenue = () => {
        const normalizedVenueName = normalizeCatalogName(newVenueName);

        if (!draft) {
            return;
        }

        if (!normalizedVenueName) {
            setOrganizationError("Venue name is required.");
            return;
        }

        const isDuplicateVenue = draft.venues.some((venue) => {
            if (
                editingVenueOriginalName !== null &&
                normalizeCatalogKey(venue) ===
                    normalizeCatalogKey(editingVenueOriginalName)
            ) {
                return false; // skip self
            }
            return (
                normalizeCatalogKey(venue) ===
                normalizeCatalogKey(normalizedVenueName)
            );
        });

        if (isDuplicateVenue) {
            setOrganizationError("Venue already exists for this organization.");
            return;
        }

        if (editingVenueOriginalName !== null) {
            handleDraftValueChange(
                "venues",
                draft.venues.map((venue) =>
                    normalizeCatalogKey(venue) ===
                    normalizeCatalogKey(editingVenueOriginalName)
                        ? normalizedVenueName
                        : venue,
                ),
            );
        } else {
            handleDraftValueChange("venues", [
                ...draft.venues,
                normalizedVenueName,
            ]);
        }
        setNewVenueName("");
        setVenueFormOpen(false);
        setEditingVenueOriginalName(null);
    };

    const handleDeleteVenue = (venueName: string) => {
        if (!draft) {
            return;
        }

        handleDraftValueChange(
            "venues",
            draft.venues.filter(
                (venue) =>
                    normalizeCatalogKey(venue) !==
                    normalizeCatalogKey(venueName),
            ),
        );
    };

    const openEditVenue = (venueName: string) => {
        setNewVenueName(venueName);
        setEditingVenueOriginalName(venueName);
        setVenueFormOpen(true);
    };

    const openEditPosition = (position: OrganizationPosition) => {
        setNewPositionName(position.name);
        setNewPositionDefaultRate(
            position.defaultRate !== null && position.defaultRate !== undefined
                ? String(position.defaultRate)
                : "",
        );
        setEditingPositionOriginalName(position.name);
        setPositionFormOpen(true);
    };

    const handleSavePosition = () => {
        const normalizedPositionName = normalizeCatalogName(newPositionName);

        if (!draft) {
            return;
        }

        if (!normalizedPositionName) {
            setOrganizationError("Position name is required.");
            return;
        }

        const isDuplicatePosition = draft.positions.some((position) => {
            if (
                editingPositionOriginalName !== null &&
                normalizeCatalogKey(position.name) ===
                    normalizeCatalogKey(editingPositionOriginalName)
            ) {
                return false; // skip self
            }
            return (
                normalizeCatalogKey(position.name) ===
                normalizeCatalogKey(normalizedPositionName)
            );
        });

        if (isDuplicatePosition) {
            setOrganizationError(
                "Position already exists for this organization.",
            );
            return;
        }

        const normalizedDefaultRate = newPositionDefaultRate.trim();
        const parsedDefaultRate = normalizedDefaultRate.length
            ? Number(normalizedDefaultRate)
            : null;

        if (
            normalizedDefaultRate.length > 0 &&
            (parsedDefaultRate === null ||
                !Number.isFinite(parsedDefaultRate) ||
                parsedDefaultRate < 0)
        ) {
            setOrganizationError("Default hourly rate must be 0 or greater.");
            return;
        }

        const updatedPosition = {
            name: normalizedPositionName,
            defaultRate: parsedDefaultRate,
        };

        if (editingPositionOriginalName !== null) {
            handleDraftValueChange(
                "positions",
                draft.positions.map((p) =>
                    normalizeCatalogKey(p.name) ===
                    normalizeCatalogKey(editingPositionOriginalName)
                        ? updatedPosition
                        : p,
                ),
            );
        } else {
            handleDraftValueChange("positions", [
                ...draft.positions,
                updatedPosition,
            ]);
        }
        setNewPositionName("");
        setNewPositionDefaultRate("");
        setPositionFormOpen(false);
        setEditingPositionOriginalName(null);
    };

    const handleDeletePosition = (positionName: string) => {
        if (!draft) {
            return;
        }

        handleDraftValueChange(
            "positions",
            draft.positions.filter(
                (position) =>
                    normalizeCatalogKey(position.name) !==
                    normalizeCatalogKey(positionName),
            ),
        );
    };

    const handleSaveOrganization = async () => {
        if (!selectedOrganization || !draft || isSavingOrganization) {
            return;
        }

        const normalizedTimezone = draft.timezone.trim();
        if (!normalizedTimezone) {
            setOrganizationError("Timezone is required.");
            return;
        }

        setIsSavingOrganization(true);
        setOrganizationError(null);

        try {
            const result = await store.updateOrganization(
                selectedOrganization.organizationId,
                {
                    timezone: normalizedTimezone,
                    payPeriodStartDay: draft.payPeriodStartDay,
                    workweekStartDay: draft.workweekStartDay,
                    notes: draft.notes.trim() ? draft.notes : null,
                    venues: [...draft.venues],
                    positions: draft.positions.map((position) => ({
                        name: position.name,
                        defaultRate:
                            typeof position.defaultRate === "number"
                                ? position.defaultRate
                                : position.defaultRate === null
                                  ? null
                                  : undefined,
                    })),
                },
            );

            if (!result.success) {
                setOrganizationError(
                    getDalErrorMessage(
                        result.error,
                        "Failed to save organization changes.",
                    ),
                );
            }
        } finally {
            setIsSavingOrganization(false);
        }
    };

    return (
        <div className="organizations-panel" data-testid="organizations-panel">
            <h2 className="organizations-panel__title">Organizations</h2>
            <ul
                className="organizations-panel__list"
                data-testid="organizations-list"
            >
                {store.organizations.map((organization) => (
                    <li key={organization.organizationId}>
                        <button
                            type="button"
                            className="organizations-panel__org-link"
                            data-testid="organization-link"
                            data-organization-id={organization.organizationId}
                            onClick={() =>
                                void openOrganizationModal(
                                    organization.organizationId,
                                )
                            }
                        >
                            {organization.name}
                        </button>
                    </li>
                ))}
            </ul>

            {selectedOrganization && draft && (
                <div
                    className="organizations-panel__modal-backdrop"
                    role="presentation"
                >
                    <div
                        className="organizations-panel__modal"
                        data-testid="organization-details-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="organization-details-title"
                    >
                        <div className="organizations-panel__modal-header">
                            <h3 id="organization-details-title">
                                {selectedOrganization.name}
                            </h3>
                            <button
                                type="button"
                                className="organizations-panel__modal-close"
                                data-testid="organization-details-close"
                                onClick={closeOrganizationModal}
                                aria-label="Close organization details"
                            >
                                X
                            </button>
                        </div>

                        <section className="organizations-panel__section">
                            <h4>Organization Settings</h4>
                            <div className="organizations-panel__details-grid organizations-panel__details-grid--editable">
                                <div className="organizations-panel__field">
                                    <label htmlFor="organization-timezone">
                                        Timezone
                                    </label>
                                    <input
                                        id="organization-timezone"
                                        type="text"
                                        value={draft.timezone}
                                        onChange={(event) =>
                                            handleDraftValueChange(
                                                "timezone",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="e.g., America/Los_Angeles"
                                    />
                                </div>
                                <div className="organizations-panel__field">
                                    <label htmlFor="organization-pay-period-start">
                                        Pay Period Start Day
                                    </label>
                                    <select
                                        id="organization-pay-period-start"
                                        value={draft.payPeriodStartDay}
                                        onChange={(event) =>
                                            handleDraftValueChange(
                                                "payPeriodStartDay",
                                                Number(event.target.value),
                                            )
                                        }
                                    >
                                        {weekdayOptions.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="organizations-panel__field">
                                    <label htmlFor="organization-workweek-start">
                                        Workweek Start Day
                                    </label>
                                    <select
                                        id="organization-workweek-start"
                                        value={draft.workweekStartDay}
                                        onChange={(event) =>
                                            handleDraftValueChange(
                                                "workweekStartDay",
                                                Number(event.target.value),
                                            )
                                        }
                                    >
                                        {weekdayOptions.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </section>

                        <section className="organizations-panel__section">
                            <div className="organizations-panel__section-header">
                                <h4>Positions</h4>
                                {!positionFormOpen && (
                                    <button
                                        type="button"
                                        className="organizations-panel__catalog-new-btn"
                                        onClick={() => {
                                            setEditingPositionOriginalName(
                                                null,
                                            );
                                            setNewPositionName("");
                                            setNewPositionDefaultRate("");
                                            setPositionFormOpen(true);
                                        }}
                                    >
                                        + New Position
                                    </button>
                                )}
                            </div>

                            {draft.positions.length > 0 && (
                                <ul className="organizations-panel__catalog-list">
                                    {draft.positions.map((position) => (
                                        <li key={position.name}>
                                            <button
                                                type="button"
                                                className="organizations-panel__catalog-item-btn"
                                                onClick={() =>
                                                    openEditPosition(position)
                                                }
                                                aria-label={`Edit position ${position.name}`}
                                            >
                                                <span>{position.name}</span>
                                                <span className="organizations-panel__catalog-meta">
                                                    {typeof position.defaultRate ===
                                                    "number"
                                                        ? `$${position.defaultRate.toFixed(2)}/hr`
                                                        : "No default rate"}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="organizations-panel__catalog-action"
                                                onClick={() =>
                                                    handleDeletePosition(
                                                        position.name,
                                                    )
                                                }
                                                aria-label={`Delete position ${position.name}`}
                                            >
                                                Delete
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {positionFormOpen && (
                                <div className="organizations-panel__catalog-editor">
                                    <div className="organizations-panel__field">
                                        <label htmlFor="organization-position-name">
                                            Position Name
                                        </label>
                                        <input
                                            id="organization-position-name"
                                            type="text"
                                            value={newPositionName}
                                            onChange={(event) =>
                                                setNewPositionName(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="e.g., Audio Engineer"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="organizations-panel__field">
                                        <label htmlFor="organization-position-rate">
                                            Default Hourly Rate
                                        </label>
                                        <input
                                            id="organization-position-rate"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={newPositionDefaultRate}
                                            onChange={(event) =>
                                                setNewPositionDefaultRate(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Optional"
                                        />
                                    </div>
                                    <div className="organizations-panel__catalog-editor-actions">
                                        <button
                                            type="button"
                                            className="organizations-panel__button organizations-panel__button--secondary"
                                            onClick={handleSavePosition}
                                        >
                                            {editingPositionOriginalName !==
                                            null
                                                ? "Update Position"
                                                : "Add Position"}
                                        </button>
                                        <button
                                            type="button"
                                            className="organizations-panel__catalog-cancel"
                                            onClick={() => {
                                                setPositionFormOpen(false);
                                                setEditingPositionOriginalName(
                                                    null,
                                                );
                                                setNewPositionName("");
                                                setNewPositionDefaultRate("");
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="organizations-panel__section">
                            <div className="organizations-panel__section-header">
                                <h4>Venues</h4>
                                {!venueFormOpen && (
                                    <button
                                        type="button"
                                        className="organizations-panel__catalog-new-btn"
                                        onClick={() => {
                                            setEditingVenueOriginalName(null);
                                            setNewVenueName("");
                                            setVenueFormOpen(true);
                                        }}
                                    >
                                        + New Venue
                                    </button>
                                )}
                            </div>
                            {draft.venues.length > 0 && (
                                <ul className="organizations-panel__catalog-list">
                                    {draft.venues.map((venue) => (
                                        <li key={venue}>
                                            <button
                                                type="button"
                                                className="organizations-panel__catalog-item-btn"
                                                onClick={() =>
                                                    openEditVenue(venue)
                                                }
                                                aria-label={`Edit venue ${venue}`}
                                            >
                                                {venue}
                                            </button>
                                            <button
                                                type="button"
                                                className="organizations-panel__catalog-action"
                                                onClick={() =>
                                                    handleDeleteVenue(venue)
                                                }
                                                aria-label={`Delete venue ${venue}`}
                                            >
                                                Delete
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {venueFormOpen && (
                                <div className="organizations-panel__catalog-editor">
                                    <div className="organizations-panel__field">
                                        <label htmlFor="organization-venue-name">
                                            Venue Name
                                        </label>
                                        <input
                                            id="organization-venue-name"
                                            type="text"
                                            value={newVenueName}
                                            onChange={(event) =>
                                                setNewVenueName(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="e.g., Main Stage"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="organizations-panel__catalog-editor-actions">
                                        <button
                                            type="button"
                                            className="organizations-panel__button organizations-panel__button--secondary"
                                            onClick={handleAddVenue}
                                        >
                                            {editingVenueOriginalName !== null
                                                ? "Update Venue"
                                                : "Add Venue"}
                                        </button>
                                        <button
                                            type="button"
                                            className="organizations-panel__catalog-cancel"
                                            onClick={() => {
                                                setVenueFormOpen(false);
                                                setEditingVenueOriginalName(
                                                    null,
                                                );
                                                setNewVenueName("");
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="organizations-panel__section organizations-panel__rulesets-section">
                            <RulesetEditor
                                organizationId={
                                    selectedOrganization.organizationId
                                }
                            />
                        </section>

                        <section className="organizations-panel__section">
                            <div className="organizations-panel__section-header organizations-panel__section-header--notes">
                                <h4>Notes</h4>
                                <div
                                    className="organizations-panel__toggle"
                                    role="group"
                                    aria-label="Notes mode"
                                >
                                    <button
                                        type="button"
                                        className={`organizations-panel__toggle-button ${
                                            notesMode === "view"
                                                ? "organizations-panel__toggle-button--active"
                                                : ""
                                        }`}
                                        onClick={() => setNotesMode("view")}
                                    >
                                        View
                                    </button>
                                    <button
                                        type="button"
                                        className={`organizations-panel__toggle-button ${
                                            notesMode === "edit"
                                                ? "organizations-panel__toggle-button--active"
                                                : ""
                                        }`}
                                        onClick={() => setNotesMode("edit")}
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>
                            <div
                                id="organization-notes-panel"
                                className="organizations-panel__notes-panel"
                                data-testid="organization-notes-panel"
                            >
                                {notesMode === "edit" ? (
                                    <div className="organizations-panel__field organizations-panel__notes-editor">
                                        <label htmlFor="organization-notes">
                                            Notes (Markdown)
                                        </label>
                                        <textarea
                                            id="organization-notes"
                                            value={draft.notes}
                                            onChange={(event) =>
                                                handleDraftValueChange(
                                                    "notes",
                                                    event.target.value,
                                                )
                                            }
                                            rows={10}
                                            placeholder="Use markdown for call details, access notes, or reminders."
                                        />
                                    </div>
                                ) : draft.notes.trim() ? (
                                    <div
                                        className="organizations-panel__markdown"
                                        data-testid="organization-notes-preview"
                                    >
                                        <ReactMarkdown>
                                            {draft.notes}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="organizations-panel__markdown organizations-panel__empty">
                                        Markdown preview appears here.
                                    </div>
                                )}
                            </div>
                        </section>

                        {organizationError && (
                            <p
                                className="organizations-panel__error"
                                role="alert"
                            >
                                {organizationError}
                            </p>
                        )}

                        {deleteOrgConfirmId ===
                        selectedOrganization.organizationId ? (
                            <>
                                <p>
                                    This will delete "
                                    {selectedOrganization.name}" and all
                                    associated rulesets and entries. This action
                                    cannot be undone.
                                </p>

                                <div className="organizations-panel__modal-actions">
                                    <button
                                        type="button"
                                        className="organizations-panel__button organizations-panel__button--secondary"
                                        onClick={() =>
                                            setDeleteOrgConfirmId(null)
                                        }
                                        disabled={isDeletingOrg}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="organizations-panel__button organizations-panel__button--danger"
                                        onClick={handleDeleteOrganization}
                                        disabled={isDeletingOrg}
                                    >
                                        {isDeletingOrg
                                            ? "Deleting..."
                                            : "Delete"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="organizations-panel__modal-actions">
                                <button
                                    type="button"
                                    className="organizations-panel__button organizations-panel__button--danger"
                                    onClick={() =>
                                        setDeleteOrgConfirmId(
                                            selectedOrganization.organizationId,
                                        )
                                    }
                                >
                                    Delete Organization
                                </button>
                                <button
                                    type="button"
                                    className="organizations-panel__button organizations-panel__button--primary"
                                    onClick={() =>
                                        void handleSaveOrganization()
                                    }
                                    disabled={isSavingOrganization}
                                >
                                    {isSavingOrganization
                                        ? "Saving..."
                                        : "Save Changes"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
