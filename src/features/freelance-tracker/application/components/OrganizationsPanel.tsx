import { useMemo, useState, useEffect } from "react";
import { useFreelanceTracker } from "../hooks";
import type {
    DalError,
    Id,
    Organization,
} from "@/features/freelance-tracker/contracts/types";
import { OrganizationForm, type OrganizationDraft } from "./OrganizationForm";
import "./OrganizationsPanel.css";
import { normalizeCatalogName } from "./organizationCatalog";

const createOrganizationDraft = (
    organization: Organization,
): OrganizationDraft => ({
    name: organization.name,
    timezone: organization.timezone,
    payPeriodStartDay: organization.payPeriodStartDay,
    workweekStartDay: organization.workweekStartDay,
    notes: organization.notes ?? "",
    venues: [...(organization.venues ?? [])],
    positions: [...(organization.positions ?? [])],
    rulesetIds: [...(organization.rulesetIds ?? [])],
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
    const [deleteOrgConfirmId, setDeleteOrgConfirmId] = useState<Id | null>(
        null,
    );
    const [isDeletingOrg, setIsDeletingOrg] = useState(false);
    const [draft, setDraft] = useState<OrganizationDraft | null>(null);
    const [organizationError, setOrganizationError] = useState<string | null>(
        null,
    );
    const [isSavingOrganization, setIsSavingOrganization] = useState(false);

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
            setOrganizationError(null);
            return;
        }

        setDraft(createOrganizationDraft(selectedOrganization));
        setOrganizationError(null);
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
        setOrganizationError(null);
    };

    const openOrganizationModal = async (organizationId: Id) => {
        setSelectedOrganizationId(organizationId);
        setDeleteOrgConfirmId(null);
        await Promise.all([
            store.loadRulesets(organizationId),
            store.loadSharedRulesets(),
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

    const handleSaveOrganization = async () => {
        if (!selectedOrganization || !draft || isSavingOrganization) {
            return;
        }

        const normalizedName = normalizeCatalogName(draft.name);
        if (!normalizedName) {
            setOrganizationError("Organization name is required.");
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
                    name: normalizedName,
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
                    rulesetIds: [...draft.rulesetIds],
                },
            );

            if (!result.success) {
                setOrganizationError(
                    getDalErrorMessage(
                        result.error,
                        "Failed to save organization changes.",
                    ),
                );
                return;
            }

            closeOrganizationModal();
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

            {selectedOrganization &&
                draft &&
                (deleteOrgConfirmId === selectedOrganization.organizationId ? (
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

                            <p>
                                This will delete "{selectedOrganization.name}"
                                and all associated entries. Shared rulesets
                                remain available to other organizations. This
                                action cannot be undone.
                            </p>

                            <div className="organizations-panel__modal-actions">
                                <button
                                    type="button"
                                    className="organizations-panel__button organizations-panel__button--secondary"
                                    onClick={() => setDeleteOrgConfirmId(null)}
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
                                    {isDeletingOrg ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <OrganizationForm
                        mode="edit"
                        draft={draft}
                        error={organizationError}
                        isSaving={isSavingOrganization}
                        organizationId={selectedOrganization.organizationId}
                        sharedRulesets={store.sharedRulesets}
                        onChangeDraft={handleDraftValueChange}
                        onCancel={closeOrganizationModal}
                        onSave={() => void handleSaveOrganization()}
                        onDeleteOrganizationClick={() =>
                            setDeleteOrgConfirmId(
                                selectedOrganization.organizationId,
                            )
                        }
                        showDeleteButton
                    />
                ))}
        </div>
    );
};
