/**
 * FreelanceTrackerApp - Main container component
 * Orchestrates EntryForm, EntryHistory, and PaySummary
 * Handles responsive layout and initialization
 */

import { useEffect, useState } from "react";
import { useFreelanceTracker } from "../hooks";
import { EntryForm } from "./EntryForm";
import { EntryHistory } from "./EntryHistory";
import { PaySummary } from "./PaySummary";
import { OrganizationsPanel } from "./OrganizationsPanel";
import { SharedRulesetsPanel } from "./SharedRulesetsPanel";
import { isFirebaseAdapterEnabled } from "@/features/freelance-tracker/data";
import type { Id } from "@/features/freelance-tracker/contracts/types";
import { getSyncStatusLabel, resolveSyncStatus } from "../startupStatus";
import { resolveFirebaseModeForE2E } from "../e2eStartupOverrides";
import "./FreelanceTrackerApp.css";

type AppTab =
    | "entry"
    | "organization"
    | "shared-rulesets"
    | "history"
    | "summary";

type FreelanceTrackerAppProps = {
    firebaseMode?: boolean;
};

export const FreelanceTrackerApp: React.FC<FreelanceTrackerAppProps> = ({
    firebaseMode = resolveFirebaseModeForE2E(isFirebaseAdapterEnabled()),
}) => {
    const store = useFreelanceTracker();
    const activeOrganizationId = store.organizations[0]?.organizationId;
    const [activeTab, setActiveTab] = useState<AppTab>("entry");
    const [entryFormResetKey, setEntryFormResetKey] = useState(0);
    const [isOnline, setIsOnline] = useState<boolean>(() => {
        if (typeof navigator === "undefined") {
            return true;
        }

        return navigator.onLine;
    });

    // Initialize data layer on mount
    useEffect(() => {
        store.loadOrganizations();
    }, [store.loadOrganizations]);

    // Load histories and rulesets when organization changes
    useEffect(() => {
        if (activeOrganizationId) {
            store.loadHistories(activeOrganizationId);
            void store.loadRulesets(activeOrganizationId);
        }
    }, [activeOrganizationId, store.loadHistories, store.loadRulesets]);

    useEffect(() => {
        if (!firebaseMode || typeof window === "undefined") {
            return;
        }

        const handleOnline = () => {
            setIsOnline(true);
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [firebaseMode]);

    const handleEditEntry = (entryId: Id) => {
        store.setEditingEntry(entryId);
        setActiveTab("entry");
    };

    const handleCancelEdit = () => {
        store.setEditingEntry(null);
        setActiveTab("entry");
    };

    const handleSwitchToOrganization = () => {
        store.setEditingEntry(null);
        setEntryFormResetKey((prev) => prev + 1);
        setActiveTab("organization");
    };

    const handleSwitchToSharedRulesets = () => {
        store.setEditingEntry(null);
        setEntryFormResetKey((prev) => prev + 1);
        setActiveTab("shared-rulesets");
    };

    const syncStatus = resolveSyncStatus({
        firebaseMode,
        isOnline,
        isLoading: store.loading,
        bootstrapError: store.error,
    });

    return (
        <div className="freelance-tracker-app">
            <header className="freelance-tracker-app__header">
                <h1 className="freelance-tracker-app__title">
                    Freelance Hours Tracker
                </h1>
                {syncStatus && (
                    <span
                        className={`freelance-tracker-app__sync-status freelance-tracker-app__sync-status--${syncStatus}`}
                        aria-live="polite"
                    >
                        {getSyncStatusLabel(syncStatus)}
                    </span>
                )}
                {syncStatus === "bootstrap-error" && (
                    <button
                        type="button"
                        className="freelance-tracker-app__retry-button"
                        onClick={() => store.loadOrganizations()}
                    >
                        Retry
                    </button>
                )}
            </header>

            <div className="freelance-tracker-app__workspace">
                <nav
                    className="freelance-tracker-app__tabs"
                    aria-label="Tracker views"
                >
                    <button
                        type="button"
                        id="freelance-tab-entry"
                        aria-controls="freelance-panel-left"
                        className={`freelance-tracker-app__tab ${
                            activeTab === "entry"
                                ? "freelance-tracker-app__tab--active"
                                : ""
                        }`}
                        onClick={() => setActiveTab("entry")}
                    >
                        Entry
                    </button>
                    <button
                        type="button"
                        id="freelance-tab-organization"
                        aria-controls="freelance-panel-left"
                        className={`freelance-tracker-app__tab ${
                            activeTab === "organization"
                                ? "freelance-tracker-app__tab--active"
                                : ""
                        }`}
                        onClick={handleSwitchToOrganization}
                    >
                        <span className="freelance-tracker-app__tab-label--full">
                            Organization
                        </span>
                        <span
                            className="freelance-tracker-app__tab-label--short"
                            aria-hidden="true"
                        >
                            Org
                        </span>
                    </button>
                    <button
                        type="button"
                        id="freelance-tab-shared-rulesets"
                        aria-controls="freelance-panel-left"
                        className={`freelance-tracker-app__tab ${
                            activeTab === "shared-rulesets"
                                ? "freelance-tracker-app__tab--active"
                                : ""
                        }`}
                        onClick={handleSwitchToSharedRulesets}
                    >
                        Rulesets
                    </button>
                    <button
                        type="button"
                        id="freelance-tab-history"
                        aria-controls="freelance-panel-history"
                        className={`freelance-tracker-app__tab ${
                            activeTab === "history"
                                ? "freelance-tracker-app__tab--active"
                                : ""
                        }`}
                        onClick={() => setActiveTab("history")}
                    >
                        Entry History
                    </button>
                    <button
                        type="button"
                        id="freelance-tab-summary"
                        aria-controls="freelance-panel-summary"
                        className={`freelance-tracker-app__tab ${
                            activeTab === "summary"
                                ? "freelance-tracker-app__tab--active"
                                : ""
                        }`}
                        onClick={() => setActiveTab("summary")}
                    >
                        Pay Summary
                    </button>
                </nav>

                <main className="freelance-tracker-app__panels">
                    {/* Left panel: Entry / Organization with sub-tabs on desktop */}
                    <section
                        id="freelance-panel-left"
                        className={`freelance-tracker-app__panel freelance-tracker-app__panel--left ${
                            activeTab === "entry" ||
                            activeTab === "organization" ||
                            activeTab === "shared-rulesets"
                                ? "freelance-tracker-app__panel--active"
                                : ""
                        }`}
                    >
                        <nav
                            className="freelance-tracker-app__left-tabs"
                            aria-label="Left panel views"
                        >
                            <button
                                type="button"
                                className={`freelance-tracker-app__left-tab ${
                                    activeTab === "entry"
                                        ? "freelance-tracker-app__left-tab--active"
                                        : ""
                                }`}
                                onClick={() => setActiveTab("entry")}
                            >
                                Entry
                            </button>
                            <button
                                type="button"
                                className={`freelance-tracker-app__left-tab ${
                                    activeTab === "organization"
                                        ? "freelance-tracker-app__left-tab--active"
                                        : ""
                                }`}
                                onClick={handleSwitchToOrganization}
                            >
                                Organization
                            </button>
                            <button
                                type="button"
                                className={`freelance-tracker-app__left-tab ${
                                    activeTab === "shared-rulesets"
                                        ? "freelance-tracker-app__left-tab--active"
                                        : ""
                                }`}
                                onClick={handleSwitchToSharedRulesets}
                            >
                                Rulesets
                            </button>
                        </nav>

                        <div
                            id="freelance-panel-entry"
                            className="freelance-tracker-app__left-content"
                            data-mobile-active={
                                activeTab === "entry" ? "true" : "false"
                            }
                            data-desktop-active={
                                activeTab === "entry" ? "true" : "false"
                            }
                        >
                            <div className="freelance-tracker-app__panel-scroll">
                                <EntryForm
                                    key={`entry-form-${entryFormResetKey}-${store.editingEntryId ?? "new"}`}
                                    editingEntryId={store.editingEntryId}
                                    onCancelEdit={handleCancelEdit}
                                    onManageOrganization={
                                        handleSwitchToOrganization
                                    }
                                />
                            </div>
                        </div>

                        <div
                            id="freelance-panel-organization"
                            className="freelance-tracker-app__left-content"
                            data-mobile-active={
                                activeTab === "organization" ? "true" : "false"
                            }
                            data-desktop-active={
                                activeTab === "organization" ? "true" : "false"
                            }
                        >
                            <div className="freelance-tracker-app__panel-scroll">
                                <OrganizationsPanel />
                            </div>
                        </div>

                        <div
                            id="freelance-panel-shared-rulesets"
                            className="freelance-tracker-app__left-content"
                            data-mobile-active={
                                activeTab === "shared-rulesets"
                                    ? "true"
                                    : "false"
                            }
                            data-desktop-active={
                                activeTab === "shared-rulesets"
                                    ? "true"
                                    : "false"
                            }
                        >
                            <div className="freelance-tracker-app__panel-scroll">
                                <SharedRulesetsPanel />
                            </div>
                        </div>
                    </section>

                    {/* Middle panel: Entry History */}
                    <section
                        id="freelance-panel-history"
                        aria-labelledby="freelance-tab-history"
                        className={`freelance-tracker-app__panel freelance-tracker-app__panel--history ${
                            activeTab === "history"
                                ? "freelance-tracker-app__panel--active"
                                : ""
                        }`}
                    >
                        <div className="freelance-tracker-app__panel-scroll">
                            <EntryHistory onEditEntry={handleEditEntry} />
                        </div>
                    </section>

                    {/* Right panel: Pay Summary */}
                    <section
                        id="freelance-panel-summary"
                        aria-labelledby="freelance-tab-summary"
                        className={`freelance-tracker-app__panel freelance-tracker-app__panel--summary ${
                            activeTab === "summary"
                                ? "freelance-tracker-app__panel--active"
                                : ""
                        }`}
                    >
                        <div className="freelance-tracker-app__panel-scroll">
                            <PaySummary />
                        </div>
                    </section>
                </main>
            </div>

            {store.loading && (
                <div className="freelance-tracker-app__loading-indicator">
                    Loading...
                </div>
            )}
        </div>
    );
};
