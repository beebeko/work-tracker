/**
 * OrganizationForm - Unified form component for adding and editing organizations
 * Handles both add mode (minimal fields) and edit mode (full organization settings)
 */

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type {
    Id,
    OrganizationPosition,
    Ruleset,
} from "@/features/freelance-tracker/contracts/types";
import { RulesetEditor } from "./RulesetEditor";
import {
    normalizeCatalogKey,
    normalizeCatalogName,
} from "./organizationCatalog";

const weekdayOptions = [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
    { value: 7, label: "Sunday" },
] as const;

export type OrganizationFormMode = "add" | "edit";

export type OrganizationDraft = {
    name: string;
    payPeriodStartDay: number;
    timezone: string;
    workweekStartDay: number;
    notes: string;
    venues: string[];
    positions: OrganizationPosition[];
    rulesetIds: Id[];
};

type OrganizationFormProps = {
    mode: OrganizationFormMode;
    draft: OrganizationDraft;
    error: string | null;
    isSaving: boolean;
    organizationId?: Id; // Required for edit mode
    sharedRulesets: Ruleset[];
    canCreateSharedRulesets?: boolean;
    onChangeDraft: <K extends keyof OrganizationDraft>(
        field: K,
        value: OrganizationDraft[K],
    ) => void;
    onCancel: () => void;
    onSave: () => void;
    onDeleteOrganizationClick?: () => void;
    showDeleteButton?: boolean;
};

export const OrganizationForm: React.FC<OrganizationFormProps> = ({
    mode,
    draft,
    error,
    isSaving,
    organizationId,
    sharedRulesets,
    canCreateSharedRulesets = false,
    onChangeDraft,
    onCancel,
    onSave,
    onDeleteOrganizationClick = () => {},
    showDeleteButton = false,
}) => {
    const isAddMode = mode === "add";
    const [notesMode, setNotesMode] = useState<"view" | "edit">("view");
    const [positionFormOpen, setPositionFormOpen] = useState(false);
    const [venueFormOpen, setVenueFormOpen] = useState(false);
    const [newPositionName, setNewPositionName] = useState("");
    const [newPositionDefaultRate, setNewPositionDefaultRate] = useState("");
    const [newVenueName, setNewVenueName] = useState("");
    const [editingPositionOriginalName, setEditingPositionOriginalName] =
        useState<string | null>(null);
    const [editingVenueOriginalName, setEditingVenueOriginalName] = useState<
        string | null
    >(null);
    const [isSharedRulesetBuilderOpen, setIsSharedRulesetBuilderOpen] =
        useState(false);
    const [subFormError, setSubFormError] = useState<string | null>(null);
    const modalClassName = isAddMode
        ? "entry-form__modal-backdrop"
        : "organizations-panel__modal-backdrop";
    const formClassName = isAddMode
        ? "entry-form__modal"
        : "organizations-panel__modal";

    const title = isAddMode ? "New Organization" : "Organization Settings";
    const saveButtonLabel = isAddMode ? "Save Organization" : "Save Changes";
    const titleId = isAddMode
        ? "entry-form-organization-modal-title"
        : "organization-details-title";

    useEffect(() => {
        setNotesMode("view");
        setPositionFormOpen(false);
        setVenueFormOpen(false);
        setNewPositionName("");
        setNewPositionDefaultRate("");
        setNewVenueName("");
        setEditingPositionOriginalName(null);
        setEditingVenueOriginalName(null);
        setIsSharedRulesetBuilderOpen(false);
        setSubFormError(null);
    }, [mode, organizationId]);

    const toggleRulesetSelection = (rulesetId: Id) => {
        const nextRulesetIds = draft.rulesetIds.includes(rulesetId)
            ? draft.rulesetIds.filter((candidate) => candidate !== rulesetId)
            : [...draft.rulesetIds, rulesetId];
        onChangeDraft("rulesetIds", nextRulesetIds);
    };

    const sortedSharedRulesets = [...sharedRulesets].sort((a, b) =>
        b.effectiveDate.localeCompare(a.effectiveDate),
    );

    const resetPositionForm = () => {
        setNewPositionName("");
        setNewPositionDefaultRate("");
        setEditingPositionOriginalName(null);
        setPositionFormOpen(false);
        setSubFormError(null);
    };

    const resetVenueForm = () => {
        setNewVenueName("");
        setEditingVenueOriginalName(null);
        setVenueFormOpen(false);
        setSubFormError(null);
    };

    const openEditPosition = (position: OrganizationPosition) => {
        setVenueFormOpen(false);
        setNewVenueName("");
        setEditingVenueOriginalName(null);

        if (!normalizeCatalogName(position.name)) {
            setNewPositionName("");
            setNewPositionDefaultRate("");
            setEditingPositionOriginalName(null);
            setPositionFormOpen(true);
            setSubFormError(null);
            return;
        }

        setNewPositionName(position.name);
        setNewPositionDefaultRate(
            position.defaultRate !== null && position.defaultRate !== undefined
                ? String(position.defaultRate)
                : "",
        );
        setEditingPositionOriginalName(position.name);
        setPositionFormOpen(true);
        setSubFormError(null);
    };

    const openEditVenue = (venueName: string) => {
        setPositionFormOpen(false);
        setNewPositionName("");
        setNewPositionDefaultRate("");
        setEditingPositionOriginalName(null);

        if (!normalizeCatalogName(venueName)) {
            setNewVenueName("");
            setEditingVenueOriginalName(null);
            setVenueFormOpen(true);
            setSubFormError(null);
            return;
        }

        setNewVenueName(venueName);
        setEditingVenueOriginalName(venueName);
        setVenueFormOpen(true);
        setSubFormError(null);
    };

    const handleSavePosition = () => {
        const normalizedPositionName = normalizeCatalogName(newPositionName);

        if (!normalizedPositionName) {
            setSubFormError("Position name is required.");
            return;
        }

        const isDuplicatePosition = draft.positions.some((position) => {
            if (
                editingPositionOriginalName !== null &&
                normalizeCatalogKey(position.name) ===
                    normalizeCatalogKey(editingPositionOriginalName)
            ) {
                return false;
            }

            return (
                normalizeCatalogKey(position.name) ===
                normalizeCatalogKey(normalizedPositionName)
            );
        });

        if (isDuplicatePosition) {
            setSubFormError("Position already exists for this organization.");
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
            setSubFormError("Default hourly rate must be 0 or greater.");
            return;
        }

        const updatedPosition = {
            name: normalizedPositionName,
            defaultRate: parsedDefaultRate,
        };

        onChangeDraft(
            "positions",
            editingPositionOriginalName !== null
                ? draft.positions.map((position) =>
                      normalizeCatalogKey(position.name) ===
                      normalizeCatalogKey(editingPositionOriginalName)
                          ? updatedPosition
                          : position,
                  )
                : [...draft.positions, updatedPosition],
        );
        resetPositionForm();
    };

    const handleSaveVenue = () => {
        const normalizedVenueName = normalizeCatalogName(newVenueName);

        if (!normalizedVenueName) {
            setSubFormError("Venue name is required.");
            return;
        }

        const isDuplicateVenue = draft.venues.some((venue) => {
            if (
                editingVenueOriginalName !== null &&
                normalizeCatalogKey(venue) ===
                    normalizeCatalogKey(editingVenueOriginalName)
            ) {
                return false;
            }

            return (
                normalizeCatalogKey(venue) ===
                normalizeCatalogKey(normalizedVenueName)
            );
        });

        if (isDuplicateVenue) {
            setSubFormError("Venue already exists for this organization.");
            return;
        }

        onChangeDraft(
            "venues",
            editingVenueOriginalName !== null
                ? draft.venues.map((venue) =>
                      normalizeCatalogKey(venue) ===
                      normalizeCatalogKey(editingVenueOriginalName)
                          ? normalizedVenueName
                          : venue,
                  )
                : [...draft.venues, normalizedVenueName],
        );
        resetVenueForm();
    };

    const handleDeletePosition = (positionName: string) => {
        onChangeDraft(
            "positions",
            draft.positions.filter(
                (position) =>
                    normalizeCatalogKey(position.name) !==
                    normalizeCatalogKey(positionName),
            ),
        );
        setSubFormError(null);
    };

    const handleDeleteVenue = (venueName: string) => {
        onChangeDraft(
            "venues",
            draft.venues.filter(
                (venue) =>
                    normalizeCatalogKey(venue) !==
                    normalizeCatalogKey(venueName),
            ),
        );
        setSubFormError(null);
    };

    return (
        <div className={modalClassName} role="presentation">
            <div
                className={formClassName}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                data-testid={
                    isAddMode ? undefined : "organization-details-dialog"
                }
            >
                {isAddMode ? (
                    <h3 id={titleId}>{title}</h3>
                ) : (
                    <div className="organizations-panel__modal-header">
                        <h3 id={titleId}>{draft.name}</h3>
                        <button
                            type="button"
                            className="organizations-panel__modal-close"
                            data-testid="organization-details-close"
                            onClick={onCancel}
                            aria-label="Close organization details"
                        >
                            X
                        </button>
                    </div>
                )}

                {/* Organization settings - common to both add and edit */}
                <section className="organizations-panel__section">
                    <h4>Organization Settings</h4>
                    <div className="organizations-panel__details-grid organizations-panel__details-grid--editable">
                        <div className="organizations-panel__field">
                            <label htmlFor="organization-name">
                                Organization Name
                            </label>
                            <input
                                id="organization-name"
                                type="text"
                                value={draft.name}
                                onChange={(event) =>
                                    onChangeDraft("name", event.target.value)
                                }
                            />
                        </div>
                        <div className="organizations-panel__field">
                            <label htmlFor="organization-timezone">
                                Timezone
                            </label>
                            <input
                                id="organization-timezone"
                                type="text"
                                value={draft.timezone}
                                onChange={(event) =>
                                    onChangeDraft(
                                        "timezone",
                                        event.target.value,
                                    )
                                }
                                placeholder="e.g., America/Los_Angeles"
                            />
                        </div>
                        <div className="organizations-panel__field">
                            <label htmlFor="organization-workweek-start">
                                Workweek Start Day
                            </label>
                            <select
                                id="organization-workweek-start"
                                value={draft.workweekStartDay}
                                onChange={(event) =>
                                    onChangeDraft(
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
                        <div className="organizations-panel__field">
                            <label htmlFor="organization-pay-period-start">
                                Pay Period Start Day
                            </label>
                            <select
                                id="organization-pay-period-start"
                                value={draft.payPeriodStartDay}
                                onChange={(event) =>
                                    onChangeDraft(
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
                    </div>
                </section>

                {/* Positions Section */}
                <section className="organizations-panel__section">
                    <div className="organizations-panel__section-header">
                        <h4>Positions</h4>
                        {!positionFormOpen && (
                            <button
                                type="button"
                                className="organizations-panel__catalog-new-btn"
                                onClick={() => {
                                    openEditPosition({
                                        name: "",
                                        defaultRate: null,
                                    });
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
                                            handleDeletePosition(position.name)
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
                                    onChange={(event) => {
                                        setNewPositionName(event.target.value);
                                        setSubFormError(null);
                                    }}
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
                                    onChange={(event) => {
                                        setNewPositionDefaultRate(
                                            event.target.value,
                                        );
                                        setSubFormError(null);
                                    }}
                                    placeholder="Optional"
                                />
                            </div>
                            {subFormError && (
                                <div
                                    className="organizations-panel__error"
                                    role="alert"
                                >
                                    {subFormError}
                                </div>
                            )}
                            <div className="organizations-panel__catalog-editor-actions">
                                <button
                                    type="button"
                                    className="organizations-panel__button organizations-panel__button--secondary"
                                    onClick={handleSavePosition}
                                >
                                    {editingPositionOriginalName !== null
                                        ? "Update Position"
                                        : "Add Position"}
                                </button>
                                <button
                                    type="button"
                                    className="organizations-panel__catalog-cancel"
                                    onClick={resetPositionForm}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Venues Section */}
                <section className="organizations-panel__section">
                    <div className="organizations-panel__section-header">
                        <h4>Venues</h4>
                        {!venueFormOpen && (
                            <button
                                type="button"
                                className="organizations-panel__catalog-new-btn"
                                onClick={() => {
                                    openEditVenue("");
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
                                        onClick={() => openEditVenue(venue)}
                                        aria-label={`Edit venue ${venue}`}
                                    >
                                        {venue}
                                    </button>
                                    <button
                                        type="button"
                                        className="organizations-panel__catalog-action"
                                        onClick={() => handleDeleteVenue(venue)}
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
                                    onChange={(event) => {
                                        setNewVenueName(event.target.value);
                                        setSubFormError(null);
                                    }}
                                    placeholder="e.g., Main Stage"
                                    autoFocus
                                />
                            </div>
                            {subFormError && (
                                <div
                                    className="organizations-panel__error"
                                    role="alert"
                                >
                                    {subFormError}
                                </div>
                            )}
                            <div className="organizations-panel__catalog-editor-actions">
                                <button
                                    type="button"
                                    className="organizations-panel__button organizations-panel__button--secondary"
                                    onClick={handleSaveVenue}
                                >
                                    {editingVenueOriginalName !== null
                                        ? "Update Venue"
                                        : "Add Venue"}
                                </button>
                                <button
                                    type="button"
                                    className="organizations-panel__catalog-cancel"
                                    onClick={resetVenueForm}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {/* Shared Rulesets Section */}
                <section className="organizations-panel__section">
                    <div className="organizations-panel__section-header">
                        <h4>Shared Rulesets</h4>
                        {canCreateSharedRulesets && (
                            <button
                                type="button"
                                className="organizations-panel__catalog-new-btn"
                                onClick={() =>
                                    setIsSharedRulesetBuilderOpen(
                                        (current) => !current,
                                    )
                                }
                            >
                                {isSharedRulesetBuilderOpen
                                    ? "Hide Shared Ruleset Builder"
                                    : "+ New Shared Ruleset"}
                            </button>
                        )}
                    </div>
                    {sortedSharedRulesets.length > 0 ? (
                        <ul className="organizations-panel__catalog-list">
                            {sortedSharedRulesets.map((ruleset) => {
                                const inputId = `shared-ruleset-${ruleset.rulesetId}`;
                                const ruleCount = ruleset.rules.length;
                                return (
                                    <li key={ruleset.rulesetId}>
                                        <label
                                            htmlFor={inputId}
                                            className="organizations-panel__shared-ruleset-option"
                                        >
                                            <input
                                                id={inputId}
                                                type="checkbox"
                                                checked={draft.rulesetIds.includes(
                                                    ruleset.rulesetId,
                                                )}
                                                onChange={() =>
                                                    toggleRulesetSelection(
                                                        ruleset.rulesetId,
                                                    )
                                                }
                                            />
                                            <span>
                                                Effective{" "}
                                                {ruleset.effectiveDate}
                                            </span>
                                            <span className="organizations-panel__catalog-meta">
                                                {ruleCount} rule
                                                {ruleCount === 1 ? "" : "s"}
                                            </span>
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <p className="organizations-panel__empty">
                            No shared rulesets yet.
                        </p>
                    )}

                    {canCreateSharedRulesets && isSharedRulesetBuilderOpen && (
                        <div className="organizations-panel__shared-ruleset-builder">
                            <RulesetEditor scope="shared" />
                        </div>
                    )}
                </section>

                {/* Rulesets Section */}
                {organizationId && (
                    <section className="organizations-panel__section organizations-panel__rulesets-section">
                        <RulesetEditor organizationId={organizationId} />
                    </section>
                )}

                {/* Notes Section */}
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
                                        onChangeDraft(
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
                                <ReactMarkdown>{draft.notes}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="organizations-panel__markdown organizations-panel__empty">
                                Markdown preview appears here.
                            </div>
                        )}
                    </div>
                </section>

                {error && (
                    <div
                        className={
                            isAddMode
                                ? "entry-form__error"
                                : "organizations-panel__error"
                        }
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                {/* Action buttons */}
                <div
                    className={
                        isAddMode
                            ? "entry-form__modal-actions"
                            : "organizations-panel__modal-actions"
                    }
                >
                    {isAddMode ? (
                        <>
                            <button
                                type="button"
                                className="entry-form__modal-secondary"
                                onClick={onCancel}
                                disabled={isSaving}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="entry-form__modal-primary"
                                onClick={() => {
                                    setSubFormError(null);
                                    onSave();
                                }}
                                disabled={isSaving}
                            >
                                {isSaving ? "Saving..." : saveButtonLabel}
                            </button>
                        </>
                    ) : (
                        <>
                            {showDeleteButton && (
                                <button
                                    type="button"
                                    className="organizations-panel__button organizations-panel__button--danger"
                                    onClick={onDeleteOrganizationClick}
                                >
                                    Delete Organization
                                </button>
                            )}
                            <button
                                type="button"
                                className="organizations-panel__button organizations-panel__button--primary"
                                onClick={() => {
                                    setSubFormError(null);
                                    onSave();
                                }}
                                disabled={isSaving}
                            >
                                {isSaving ? "Saving..." : saveButtonLabel}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
