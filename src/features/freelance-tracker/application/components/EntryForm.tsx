/**
 * EntryForm - Form for creating and editing work entries
 * Includes venue, date, time, position, rate, event, tags, and notes fields
 */

import { useEffect, useState } from "react";
import { useFreelanceTracker, useEntryForm } from "../hooks";
import type { Id } from "@/features/freelance-tracker/contracts/types";
import { EntryFormAutocompleteList } from "./EntryFormAutocompleteList";
import { EntryFormPaySection } from "./EntryFormPaySection";
import { EntryFormPositionModal } from "./EntryFormPositionModal";
import {
    EMPTY_AUTOCOMPLETE_STATE,
    createDefaultEntryValues,
    createValuesFromInitial,
    findOrganizationByName,
    getErrorMsg,
    getOrganizationNameById,
    normalizeCatalogKey,
    normalizeCatalogName,
    type AutocompleteState,
} from "./EntryForm.utils";
import "./EntryForm.css";

const ENTRY_FORM_MULTI_COLUMN_MEDIA_QUERY = "(min-width: 480px)";

type ComboAutocompleteField = "organization" | "venue" | "position";

interface EntryFormProps {
    onClose?: () => void;
    onCancelEdit?: () => void;
    editingEntryId?: Id | null;
    onManageOrganization?: () => void;
}

export const EntryForm: React.FC<EntryFormProps> = ({
    onClose,
    onCancelEdit,
    editingEntryId,
    onManageOrganization,
}) => {
    const store = useFreelanceTracker();
    const form = useEntryForm(editingEntryId);

    const initialOrganizationName = getOrganizationNameById(
        store.organizations,
        form.initialValues.organizationId,
    );

    const [values, setValues] = useState(() =>
        createValuesFromInitial(form.initialValues, initialOrganizationName),
    );

    const [autocomplete, setAutocomplete] = useState<AutocompleteState>(
        EMPTY_AUTOCOMPLETE_STATE,
    );
    const [validationError, setValidationError] = useState<string | null>(null);
    const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);
    const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
    const [positionModalError, setPositionModalError] = useState<string | null>(
        null,
    );
    const [isSavingPosition, setIsSavingPosition] = useState(false);
    const [positionDraft, setPositionDraft] = useState({
        name: "",
        defaultRate: "",
    });
    const [isSingleColumnComboboxLayout, setIsSingleColumnComboboxLayout] =
        useState(false);

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) {
            return;
        }

        const mediaQueryList = window.matchMedia(
            ENTRY_FORM_MULTI_COLUMN_MEDIA_QUERY,
        );
        const updateMatch = (event?: MediaQueryListEvent) => {
            setIsSingleColumnComboboxLayout(
                !(event?.matches ?? mediaQueryList.matches),
            );
        };

        updateMatch();

        if (typeof mediaQueryList.addEventListener === "function") {
            mediaQueryList.addEventListener("change", updateMatch);

            return () => {
                mediaQueryList.removeEventListener("change", updateMatch);
            };
        }

        if (typeof mediaQueryList.addListener === "function") {
            mediaQueryList.addListener(updateMatch);

            return () => {
                mediaQueryList.removeListener(updateMatch);
            };
        }

        return;
    }, []);

    useEffect(() => {
        if (editingEntryId && form.editingEntry) {
            const editingOrganizationName = getOrganizationNameById(
                store.organizations,
                form.editingEntry.organizationId,
            );

            setValues(
                createValuesFromInitial(
                    {
                        ...form.editingEntry,
                        paymentMode: form.editingEntry.paymentMode ?? "hourly",
                        flatFeeAmount: form.editingEntry.flatFeeAmount ?? null,
                        mealPenaltyCount:
                            form.editingEntry.mealPenaltyCount ?? 0,
                    },
                    editingOrganizationName,
                ),
            );
        } else if (!editingEntryId) {
            const initialName = getOrganizationNameById(
                store.organizations,
                form.initialValues.organizationId,
            );

            setValues(
                createDefaultEntryValues(
                    form.initialValues.organizationId,
                    initialName,
                ),
            );
        }

        setValidationError(null);
        setAutocomplete(EMPTY_AUTOCOMPLETE_STATE);
        setIsPositionModalOpen(false);
        setPositionModalError(null);
        setPositionDraft({ name: "", defaultRate: "" });
    }, [editingEntryId, form.editingEntry, form.initialValues.organizationId]);

    const organizationMatch = findOrganizationByName(
        store.organizations,
        values.organizationName,
    );
    const resolvedOrganizationId =
        values.organizationId ||
        organizationMatch?.organizationId ||
        ("" as Id);
    const selectedOrganization = store.organizations.find(
        (organization) =>
            organization.organizationId === resolvedOrganizationId,
    );

    useEffect(() => {
        if (!resolvedOrganizationId) {
            return;
        }

        void store.loadHistories(resolvedOrganizationId);
    }, [resolvedOrganizationId, store.loadHistories]);

    const existingPosition = selectedOrganization?.positions.find(
        (position) =>
            normalizeCatalogKey(position.name) ===
            normalizeCatalogKey(values.position),
    );

    const showManageOrganizationPrompt =
        !!values.organizationName.trim() && !organizationMatch;
    const showCreatePositionPrompt =
        !!selectedOrganization &&
        !!normalizeCatalogName(values.position) &&
        !existingPosition;

    const getOrganizationSuggestions = (searchTerm: string) => {
        const normalized = searchTerm.trim().toLowerCase();

        return store.organizations
            .map((organization) => organization.name)
            .filter((organizationName) =>
                normalized.length === 0
                    ? true
                    : organizationName.toLowerCase().includes(normalized),
            )
            .slice(0, 10);
    };

    const getAutocompleteSuggestions = (
        field: ComboAutocompleteField,
        searchTerm: string,
    ) => {
        if (field === "organization") {
            return getOrganizationSuggestions(searchTerm);
        }

        if (field === "venue") {
            return resolvedOrganizationId
                ? form.autocompleteVenues(searchTerm, resolvedOrganizationId)
                : [];
        }

        return form.autocompletePositions(searchTerm, resolvedOrganizationId);
    };

    const openAutocomplete = (
        field: ComboAutocompleteField,
        searchTerm: string,
    ) => {
        const suggestions = getAutocompleteSuggestions(field, searchTerm);
        setAutocomplete({ field, suggestions, selectedIndex: -1 });
    };

    const handleComboboxToggle = (field: ComboAutocompleteField) => {
        if (autocomplete.field === field) {
            setAutocomplete(EMPTY_AUTOCOMPLETE_STATE);
            return;
        }

        openAutocomplete(field, "");
    };

    const handleComboboxFocus = (field: ComboAutocompleteField) => {
        if (!isSingleColumnComboboxLayout) {
            return;
        }

        const valueByField = {
            organization: values.organizationName,
            venue: values.venue,
            position: values.position,
        };

        openAutocomplete(field, valueByField[field]);
    };

    useEffect(() => {
        if (
            values.paymentMode !== "hourly" ||
            values.rate.trim().length > 0 ||
            !resolvedOrganizationId ||
            !normalizeCatalogName(values.position)
        ) {
            return;
        }

        const defaultRate = form.getOrganizationPositionDefaultRate(
            values.position,
            resolvedOrganizationId,
        );

        if (typeof defaultRate !== "number") {
            return;
        }

        setValues((prev) => {
            if (prev.rate.trim().length > 0) {
                return prev;
            }

            return {
                ...prev,
                rate: defaultRate.toString(),
            };
        });
    }, [
        form,
        resolvedOrganizationId,
        values.paymentMode,
        values.position,
        values.rate,
    ]);

    const openCreatePositionModal = () => {
        if (!selectedOrganization) {
            return;
        }

        setPositionDraft({
            name: normalizeCatalogName(values.position),
            defaultRate:
                values.paymentMode === "hourly" ? values.rate.trim() : "",
        });
        setPositionModalError(null);
        setIsPositionModalOpen(true);
    };

    const closeCreatePositionModal = () => {
        setIsPositionModalOpen(false);
        setPositionModalError(null);
        setIsSavingPosition(false);
    };

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
    ) => {
        const { name, value } = e.currentTarget;

        if (name === "organizationName") {
            const match = findOrganizationByName(store.organizations, value);
            setValues((prev) => ({
                ...prev,
                organizationName: value,
                organizationId: match?.organizationId || ("" as Id),
            }));
            if (isSingleColumnComboboxLayout) {
                openAutocomplete("organization", value);
            }
            if (match) {
                setValidationError(null);
            }
            return;
        }

        if (name === "paymentMode") {
            setValues((prev) => ({
                ...prev,
                paymentMode: value as "hourly" | "flat-fee",
                rate: value === "hourly" ? prev.rate : "",
                flatFeeAmount: value === "flat-fee" ? prev.flatFeeAmount : "",
            }));
            setValidationError(null);
            return;
        }

        if (name === "position") {
            setPositionModalError(null);
        }

        setValues((prev) => ({ ...prev, [name]: value }));

        if (name === "venue") {
            openAutocomplete("venue", value);
            return;
        }

        if (name === "position") {
            openAutocomplete("position", value);
            return;
        }

        if (name === "tagInput") {
            const suggestions = form.autocompleteTags(value);
            setAutocomplete({ field: "tags", suggestions, selectedIndex: -1 });
        }
    };

    const handleAddTag = () => {
        const trimmed = values.tagInput.trim();
        if (trimmed && !values.tags.includes(trimmed)) {
            setValues((prev) => ({
                ...prev,
                tags: [...prev.tags, trimmed],
                tagInput: "",
            }));
            setAutocomplete(EMPTY_AUTOCOMPLETE_STATE);
        }
    };

    const handleRemoveTag = (tag: string) => {
        setValues((prev) => ({
            ...prev,
            tags: prev.tags.filter((currentTag) => currentTag !== tag),
        }));
    };

    const handleAutocompleteSelect = (suggestion: string) => {
        if (autocomplete.field === "organization") {
            const match = findOrganizationByName(
                store.organizations,
                suggestion,
            );
            setValues((prev) => ({
                ...prev,
                organizationName: suggestion,
                organizationId: match?.organizationId || ("" as Id),
            }));
            setValidationError(null);
        } else if (autocomplete.field === "venue") {
            setValues((prev) => ({ ...prev, venue: suggestion }));
        } else if (autocomplete.field === "position") {
            setValues((prev) => ({ ...prev, position: suggestion }));
        } else if (autocomplete.field === "tags") {
            setValues((prev) => ({ ...prev, tagInput: suggestion }));
        }
        setAutocomplete(EMPTY_AUTOCOMPLETE_STATE);
    };

    const handleAutocompleteKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (autocomplete.suggestions.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setAutocomplete((prev) => ({
                    ...prev,
                    selectedIndex:
                        (prev.selectedIndex + 1) % prev.suggestions.length,
                }));
                break;
            case "ArrowUp":
                e.preventDefault();
                setAutocomplete((prev) => ({
                    ...prev,
                    selectedIndex:
                        prev.selectedIndex <= 0
                            ? prev.suggestions.length - 1
                            : prev.selectedIndex - 1,
                }));
                break;
            case "Enter":
                e.preventDefault();
                if (autocomplete.selectedIndex >= 0) {
                    handleAutocompleteSelect(
                        autocomplete.suggestions[autocomplete.selectedIndex],
                    );
                }
                break;
            case "Escape":
                setAutocomplete(EMPTY_AUTOCOMPLETE_STATE);
                break;
        }
    };

    const handleTagInputKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (autocomplete.selectedIndex >= 0) {
                handleAutocompleteSelect(
                    autocomplete.suggestions[autocomplete.selectedIndex],
                );
                return;
            }
            handleAddTag();
            return;
        }

        handleAutocompleteKeyDown(e);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isSubmittingEntry) {
            return;
        }

        const normalizedPositionName = normalizeCatalogName(values.position);
        const normalizedVenueName = normalizeCatalogName(values.venue);

        if (
            selectedOrganization &&
            normalizedPositionName &&
            !selectedOrganization.positions.some(
                (position) =>
                    normalizeCatalogKey(position.name) ===
                    normalizeCatalogKey(normalizedPositionName),
            )
        ) {
            openCreatePositionModal();
            return;
        }

        const paymentMode = values.paymentMode;
        const rateValue =
            paymentMode === "hourly" && values.rate
                ? parseFloat(values.rate)
                : null;
        const flatFeeAmountValue =
            paymentMode === "flat-fee" && values.flatFeeAmount
                ? parseFloat(values.flatFeeAmount)
                : null;

        const valuesForValidation = {
            ...values,
            paymentMode,
            rate: rateValue,
            flatFeeAmount: flatFeeAmountValue,
            organizationId: resolvedOrganizationId,
        };

        const error = form.validateForm(valuesForValidation);
        if (error) {
            setValidationError(error);
            return;
        }

        const entryData = {
            organizationId: resolvedOrganizationId as Id,
            dateWorked: values.dateWorked,
            startTime: values.startTime,
            endTime: values.endTime,
            venue: normalizedVenueName || null,
            position: normalizedPositionName,
            paymentMode,
            rate: rateValue,
            flatFeeAmount: flatFeeAmountValue,
            event: values.event || null,
            tags: values.tags,
            notes: values.notes || null,
            mealPenaltyCount: values.mealPenaltyCount,
        };

        setIsSubmittingEntry(true);

        try {
            if (editingEntryId) {
                const result = await store.updateEntry(
                    editingEntryId,
                    entryData,
                );
                if (result.success) {
                    onClose?.();
                } else {
                    setValidationError(
                        getErrorMsg(result.error, "Failed to update entry"),
                    );
                }
                return;
            }

            const result = await store.createEntry(entryData);
            if (result.success) {
                setValues(
                    createDefaultEntryValues(
                        values.organizationId,
                        values.organizationName,
                    ),
                );
                setValidationError(null);
            } else {
                setValidationError(
                    getErrorMsg(result.error, "Failed to create entry"),
                );
            }
        } finally {
            setIsSubmittingEntry(false);
        }
    };

    const handleSavePosition = async () => {
        if (!selectedOrganization || isSavingPosition) {
            return;
        }

        const normalizedPositionName = normalizeCatalogName(positionDraft.name);
        if (!normalizedPositionName) {
            setPositionModalError("Position name is required");
            return;
        }

        const parsedDefaultRate = positionDraft.defaultRate.trim().length
            ? Number(positionDraft.defaultRate)
            : null;

        if (
            positionDraft.defaultRate.trim().length > 0 &&
            (parsedDefaultRate === null ||
                !Number.isFinite(parsedDefaultRate) ||
                parsedDefaultRate < 0)
        ) {
            setPositionModalError("Default hourly rate must be 0 or greater");
            return;
        }

        setIsSavingPosition(true);
        setPositionModalError(null);

        try {
            const result = await store.createOrganizationPosition({
                organizationId: selectedOrganization.organizationId,
                position: normalizedPositionName,
                defaultRate: parsedDefaultRate,
            });

            if (!result.success) {
                setPositionModalError(
                    getErrorMsg(result.error, "Failed to save position"),
                );
                return;
            }

            setValues((prev) => ({
                ...prev,
                position: normalizedPositionName,
                rate:
                    prev.paymentMode === "hourly" &&
                    prev.rate.trim().length === 0 &&
                    typeof parsedDefaultRate === "number"
                        ? parsedDefaultRate.toString()
                        : prev.rate,
            }));
            closeCreatePositionModal();
        } finally {
            setIsSavingPosition(false);
        }
    };

    const handleCancelEdit = () => {
        setValidationError(null);
        onCancelEdit?.();
    };

    return (
        <>
            <form
                className={`entry-form ${editingEntryId ? "entry-form--editing" : ""}`.trim()}
                onSubmit={handleSubmit}
                noValidate
            >
                <div className="entry-form__header">
                    <h2>{editingEntryId ? "Edit Entry" : "New Entry"}</h2>
                    {onClose && (
                        <button
                            type="button"
                            className="entry-form__close"
                            onClick={onClose}
                        >
                            ✕
                        </button>
                    )}
                </div>

                <div className="entry-form__section">
                    <div className="entry-form__row">
                        <div className="entry-form__field entry-form__field--autocomplete">
                            <label htmlFor="organizationName">
                                Organization
                            </label>
                            <div
                                className={`entry-form__autocomplete-wrapper ${
                                    isSingleColumnComboboxLayout
                                        ? "entry-form__autocomplete-wrapper--combo"
                                        : ""
                                }`.trim()}
                            >
                                <input
                                    id="organizationName"
                                    type="text"
                                    name="organizationName"
                                    value={values.organizationName}
                                    onChange={handleChange}
                                    onFocus={() =>
                                        handleComboboxFocus("organization")
                                    }
                                    onKeyDown={
                                        isSingleColumnComboboxLayout
                                            ? handleAutocompleteKeyDown
                                            : undefined
                                    }
                                    placeholder="Select or type organization"
                                    list={
                                        isSingleColumnComboboxLayout
                                            ? undefined
                                            : "entry-form-organizations"
                                    }
                                    required
                                />
                                {isSingleColumnComboboxLayout ? (
                                    <button
                                        type="button"
                                        className="entry-form__combo-toggle"
                                        onClick={() =>
                                            handleComboboxToggle("organization")
                                        }
                                        aria-label="Show organization options"
                                    >
                                        <span
                                            className="entry-form__combo-toggle-icon"
                                            aria-hidden="true"
                                        />
                                    </button>
                                ) : (
                                    <datalist id="entry-form-organizations">
                                        {store.organizations.map((org) => (
                                            <option
                                                key={org.organizationId}
                                                value={org.name}
                                            />
                                        ))}
                                    </datalist>
                                )}
                                {isSingleColumnComboboxLayout &&
                                    autocomplete.field === "organization" && (
                                        <EntryFormAutocompleteList
                                            ariaLabel="Organization suggestions"
                                            suggestions={
                                                autocomplete.suggestions
                                            }
                                            selectedIndex={
                                                autocomplete.selectedIndex
                                            }
                                            onSelect={handleAutocompleteSelect}
                                        />
                                    )}
                            </div>
                            {showManageOrganizationPrompt && (
                                <div className="entry-form__create-prompt">
                                    <span>
                                        No organization named "
                                        {values.organizationName.trim()}".
                                    </span>
                                    <button
                                        type="button"
                                        className="entry-form__create-prompt-button"
                                        onClick={onManageOrganization}
                                    >
                                        Manage Organizations
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="entry-form__field entry-form__field--autocomplete">
                            <label htmlFor="venue">Venue</label>
                            <div
                                className={`entry-form__autocomplete-wrapper ${
                                    isSingleColumnComboboxLayout
                                        ? "entry-form__autocomplete-wrapper--combo"
                                        : ""
                                }`.trim()}
                            >
                                <input
                                    id="venue"
                                    type="text"
                                    name="venue"
                                    value={values.venue}
                                    onChange={handleChange}
                                    onFocus={() => handleComboboxFocus("venue")}
                                    onKeyDown={handleAutocompleteKeyDown}
                                    placeholder="e.g., City Hall"
                                />
                                {isSingleColumnComboboxLayout && (
                                    <button
                                        type="button"
                                        className="entry-form__combo-toggle"
                                        onClick={() =>
                                            handleComboboxToggle("venue")
                                        }
                                        aria-label="Show venue options"
                                    >
                                        <span
                                            className="entry-form__combo-toggle-icon"
                                            aria-hidden="true"
                                        />
                                    </button>
                                )}
                                {autocomplete.field === "venue" && (
                                    <EntryFormAutocompleteList
                                        ariaLabel="Venue suggestions"
                                        suggestions={autocomplete.suggestions}
                                        selectedIndex={
                                            autocomplete.selectedIndex
                                        }
                                        onSelect={handleAutocompleteSelect}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="entry-form__field">
                        <label htmlFor="dateWorked">Date</label>
                        <input
                            id="dateWorked"
                            type="date"
                            name="dateWorked"
                            value={values.dateWorked}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="entry-form__row">
                        <div className="entry-form__field">
                            <label htmlFor="startTime">Start Time</label>
                            <input
                                id="startTime"
                                type="time"
                                name="startTime"
                                value={values.startTime}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="entry-form__field">
                            <label htmlFor="endTime">End Time</label>
                            <input
                                id="endTime"
                                type="time"
                                name="endTime"
                                value={values.endTime}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="entry-form__field entry-form__field--autocomplete">
                        <label htmlFor="position">Position</label>
                        <div
                            className={`entry-form__autocomplete-wrapper ${
                                isSingleColumnComboboxLayout
                                    ? "entry-form__autocomplete-wrapper--combo"
                                    : ""
                            }`.trim()}
                        >
                            <input
                                id="position"
                                type="text"
                                name="position"
                                value={values.position}
                                onChange={handleChange}
                                onFocus={() => handleComboboxFocus("position")}
                                onKeyDown={handleAutocompleteKeyDown}
                                placeholder="e.g., Sound Tech"
                                required
                            />
                            {isSingleColumnComboboxLayout && (
                                <button
                                    type="button"
                                    className="entry-form__combo-toggle"
                                    onClick={() =>
                                        handleComboboxToggle("position")
                                    }
                                    aria-label="Show position options"
                                >
                                    <span
                                        className="entry-form__combo-toggle-icon"
                                        aria-hidden="true"
                                    />
                                </button>
                            )}
                            {autocomplete.field === "position" && (
                                <EntryFormAutocompleteList
                                    ariaLabel="Position suggestions"
                                    suggestions={autocomplete.suggestions}
                                    selectedIndex={autocomplete.selectedIndex}
                                    onSelect={handleAutocompleteSelect}
                                />
                            )}
                        </div>
                        {showCreatePositionPrompt && (
                            <div className="entry-form__create-prompt">
                                <span>
                                    No position named "
                                    {normalizeCatalogName(values.position)}" for
                                    this organization.
                                </span>
                                <button
                                    type="button"
                                    className="entry-form__create-prompt-button"
                                    onClick={openCreatePositionModal}
                                >
                                    Create Position
                                </button>
                            </div>
                        )}
                    </div>

                    <EntryFormPaySection
                        paymentMode={values.paymentMode}
                        rate={values.rate}
                        flatFeeAmount={values.flatFeeAmount}
                        startTime={values.startTime}
                        endTime={values.endTime}
                        onChange={handleChange}
                    />

                    <div className="entry-form__field">
                        <label htmlFor="event">Event (optional)</label>
                        <input
                            id="event"
                            type="text"
                            name="event"
                            value={values.event}
                            onChange={handleChange}
                            placeholder="e.g., Concert, Meeting"
                        />
                    </div>

                    <div className="entry-form__field">
                        <label htmlFor="tagInput">Tags</label>
                        <div className="entry-form__tags">
                            {values.tags.map((tag) => (
                                <span key={tag} className="entry-form__tag">
                                    {tag}
                                    <button
                                        type="button"
                                        className="entry-form__tag-remove"
                                        onClick={() => handleRemoveTag(tag)}
                                    >
                                        ✕
                                    </button>
                                </span>
                            ))}
                        </div>
                        <div className="entry-form__autocomplete-wrapper">
                            <input
                                id="tagInput"
                                type="text"
                                name="tagInput"
                                value={values.tagInput}
                                onChange={handleChange}
                                onKeyDown={handleTagInputKeyDown}
                                placeholder="Add tags (press Enter)"
                            />
                            {autocomplete.field === "tags" && (
                                <EntryFormAutocompleteList
                                    ariaLabel="Tag suggestions"
                                    suggestions={autocomplete.suggestions}
                                    selectedIndex={autocomplete.selectedIndex}
                                    onSelect={handleAutocompleteSelect}
                                />
                            )}
                        </div>
                    </div>

                    <div className="entry-form__field">
                        <label htmlFor="notes">Notes (optional)</label>
                        <textarea
                            id="notes"
                            name="notes"
                            value={values.notes}
                            onChange={handleChange}
                            placeholder="Any additional notes..."
                            rows={3}
                        />
                    </div>
                </div>

                {validationError && (
                    <div className="entry-form__error">{validationError}</div>
                )}

                {store.error && (
                    <div className="entry-form__error">{store.error}</div>
                )}

                <div className="entry-form__actions">
                    {editingEntryId && (
                        <button
                            type="button"
                            className="entry-form__secondary-action"
                            onClick={handleCancelEdit}
                            disabled={isSubmittingEntry}
                        >
                            Cancel Edit
                        </button>
                    )}

                    <button
                        type="submit"
                        className="entry-form__submit"
                        disabled={isSubmittingEntry}
                    >
                        {isSubmittingEntry
                            ? "Saving..."
                            : editingEntryId
                              ? "Update Entry"
                              : "Create Entry"}
                    </button>
                </div>
            </form>

            {isPositionModalOpen && selectedOrganization && (
                <EntryFormPositionModal
                    organizationName={selectedOrganization.name}
                    draft={positionDraft}
                    error={positionModalError}
                    isSaving={isSavingPosition}
                    onChangeDraft={setPositionDraft}
                    onCancel={closeCreatePositionModal}
                    onSave={() => void handleSavePosition()}
                />
            )}
        </>
    );
};
