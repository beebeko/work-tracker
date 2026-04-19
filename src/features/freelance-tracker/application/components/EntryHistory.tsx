/**
 * EntryHistory - Display and manage work entries
 * Supports filtering by tag, sorting by columns, inline edit/delete
 */

import { useEffect, useMemo, useState } from "react";
import { useFreelanceTracker } from "../hooks";
import { isOk } from "@/features/freelance-tracker/contracts/types";
import type { Entry, Id } from "@/features/freelance-tracker/contracts/types";
import { getDataLayer } from "@/features/freelance-tracker/data";
import { PeriodSelector } from "./PeriodSelector";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { EntryHistoryRow } from "./EntryHistoryRow";
import { calculateHours, getEffectiveRate } from "./EntryHistory.utils";
import "./EntryHistory.css";

interface EntryHistoryProps {
    onEditEntry?: (entryId: Id) => void;
}

type SortField = "date" | "venue" | "position" | "rate" | "hours";
type SortDirection = "asc" | "desc";

export const EntryHistory: React.FC<EntryHistoryProps> = ({ onEditEntry }) => {
    const store = useFreelanceTracker();
    const [hasMounted, setHasMounted] = useState(false);
    const [filterByOrg, setFilterByOrg] = useState(false);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState<
        Id | ""
    >("");
    // Initialize from store.entries so the table is immediately populated on
    // first render; the DAL load in all-orgs mode then replaces this value.
    const [allEntries, setAllEntries] = useState<Entry[]>(() => store.entries);
    const [filterTag, setFilterTag] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>("date");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
    const [deleteConfirmId, setDeleteConfirmId] = useState<Id | null>(null);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    // When filter-by-org is enabled, auto-select the first valid org
    useEffect(() => {
        if (!filterByOrg) return;
        if (store.organizations.length === 0) {
            setSelectedOrganizationId("");
            return;
        }
        if (
            selectedOrganizationId &&
            store.organizations.some(
                (o) => o.organizationId === selectedOrganizationId,
            )
        ) {
            return;
        }
        setSelectedOrganizationId(store.organizations[0].organizationId);
    }, [filterByOrg, store.organizations, selectedOrganizationId]);

    // All-orgs mode: fetch entries for every org and combine
    useEffect(() => {
        if (
            filterByOrg ||
            !store.selectedPeriod ||
            store.organizations.length === 0
        ) {
            if (!filterByOrg) setAllEntries([]);
            return;
        }
        const dal = getDataLayer();
        const period = store.selectedPeriod;
        const loadAll = async () => {
            const results = await Promise.all(
                store.organizations.map((org) =>
                    dal.entries.list({
                        organizationId: org.organizationId,
                        startDate: period.startDate,
                        endDate: period.endDate,
                    }),
                ),
            );
            setAllEntries(results.filter(isOk).flatMap((r) => r.data));
        };
        void loadAll();
    }, [filterByOrg, store.organizations, store.selectedPeriod]);

    // Filtered mode: load single-org entries via store
    useEffect(() => {
        if (!filterByOrg || !selectedOrganizationId || !store.selectedPeriod) {
            return;
        }
        void store.loadEntries(selectedOrganizationId, store.selectedPeriod);
    }, [
        filterByOrg,
        store.loadEntries,
        selectedOrganizationId,
        store.selectedPeriod,
    ]);

    // Handle escape key to close delete confirmation modal
    useEffect(() => {
        const handleEscapeKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && deleteConfirmId) {
                setDeleteConfirmId(null);
            }
        };

        if (deleteConfirmId) {
            document.addEventListener("keydown", handleEscapeKey);
            return () => {
                document.removeEventListener("keydown", handleEscapeKey);
            };
        }
    }, [deleteConfirmId]);

    // Source of entries (all-orgs vs single-org filtered)
    const baseEntries = filterByOrg ? store.entries : allEntries;

    // Filter by tag
    const filteredEntries = useMemo(() => {
        if (!filterTag) return baseEntries;
        return baseEntries.filter((entry) => entry.tags.includes(filterTag));
    }, [baseEntries, filterTag]);

    // Sort entries
    const sortedEntries = useMemo(() => {
        const sorted = [...filteredEntries];
        sorted.sort((a, b) => {
            let aVal: string | number;
            let bVal: string | number;

            switch (sortField) {
                case "date":
                    aVal = a.dateWorked;
                    bVal = b.dateWorked;
                    break;
                case "venue":
                    // In our schema, venue info isn't directly stored in Entry
                    // For now, use organizationId as proxy
                    aVal = a.organizationId;
                    bVal = b.organizationId;
                    break;
                case "position":
                    aVal = a.position;
                    bVal = b.position;
                    break;
                case "rate":
                    aVal =
                        getEffectiveRate(
                            a,
                            calculateHours(a.startTime, a.endTime),
                        ) ?? 0;
                    bVal =
                        getEffectiveRate(
                            b,
                            calculateHours(b.startTime, b.endTime),
                        ) ?? 0;
                    break;
                case "hours":
                    aVal = calculateHours(a.startTime, a.endTime);
                    bVal = calculateHours(b.startTime, b.endTime);
                    break;
                default:
                    aVal = a.dateWorked;
                    bVal = b.dateWorked;
            }

            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [filteredEntries, sortField, sortDirection]);

    // Collect all unique tags for filtering
    const allTags = useMemo(() => {
        const tags = new Set<string>();
        baseEntries.forEach((entry) => {
            entry.tags.forEach((tag) => tags.add(tag));
        });
        return Array.from(tags).sort();
    }, [baseEntries]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("desc");
        }
    };

    const handleDeleteEntry = async (entryId: Id) => {
        setDeleteConfirmId(null);
        const result = await store.deleteEntry(entryId);
        // In all-orgs mode, sync local allEntries state with store mutation
        if (result.success && !filterByOrg) {
            setAllEntries((prev) => prev.filter((e) => e.entryId !== entryId));
        }
    };

    const organizationFilterControl = (
        <div className="entry-history__field">
            <label htmlFor="entry-history-organization-filter">
                Organization
            </label>
            <div className="entry-history__filter-row">
                <input
                    type="checkbox"
                    id="entry-history-filter-by-org"
                    checked={hasMounted && filterByOrg}
                    onChange={(e) => {
                        setFilterByOrg(e.currentTarget.checked);
                        if (!e.currentTarget.checked) {
                            setSelectedOrganizationId("");
                        }
                    }}
                />
                <label htmlFor="entry-history-filter-by-org">
                    Filter by organization
                </label>
            </div>
            <select
                id="entry-history-organization-filter"
                value={selectedOrganizationId}
                onChange={(event) =>
                    setSelectedOrganizationId(event.currentTarget.value as Id)
                }
                disabled={!filterByOrg || store.organizations.length === 0}
            >
                {!filterByOrg ? (
                    <option value="">All organizations</option>
                ) : store.organizations.length === 0 ? (
                    <option value="">No organizations</option>
                ) : (
                    store.organizations.map((organization) => (
                        <option
                            key={organization.organizationId}
                            value={organization.organizationId}
                        >
                            {organization.name}
                        </option>
                    ))
                )}
            </select>
        </div>
    );

    if (store.organizations.length === 0) {
        return (
            <div className="entry-history entry-history--empty">
                <div className="entry-history__panel-header">
                    <div>
                        <h2 className="entry-history__title">Entry History</h2>
                    </div>
                    {organizationFilterControl}
                </div>
                <div className="entry-history__empty-state">
                    <p>No organizations available</p>
                    <p className="entry-history__empty-hint">
                        Add an organization in the Organizations tab to view
                        history.
                    </p>
                </div>
            </div>
        );
    }

    if (baseEntries.length === 0) {
        return (
            <div className="entry-history entry-history--empty">
                <div className="entry-history__panel-header">
                    <div>
                        <h2 className="entry-history__title">Entry History</h2>
                    </div>
                    {organizationFilterControl}
                    <PeriodSelector
                        label="History Period"
                        value={store.selectedPeriod}
                        onChange={(period) =>
                            store.selectPeriod(period.startDate, period.endDate)
                        }
                        defaultPreset="this-month"
                    />
                </div>
                <div className="entry-history__empty-state">
                    <p>No entries yet</p>
                    <p className="entry-history__empty-hint">
                        {filterByOrg
                            ? "No entries for the selected organization and period."
                            : "Create your first entry in New Entry for the selected period."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="entry-history">
            <div className="entry-history__panel-header">
                <div>
                    <h2 className="entry-history__title">Entry History</h2>
                </div>
                {organizationFilterControl}
                <PeriodSelector
                    label="History Period"
                    value={store.selectedPeriod}
                    onChange={(period) =>
                        store.selectPeriod(period.startDate, period.endDate)
                    }
                    defaultPreset="this-month"
                />
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
                <div className="entry-history__filters">
                    <div className="entry-history__filter-label">
                        Filter by tag:
                    </div>
                    <div className="entry-history__tag-filter">
                        <button
                            className={`entry-history__tag-filter-btn ${
                                !filterTag
                                    ? "entry-history__tag-filter-btn--active"
                                    : ""
                            }`}
                            onClick={() => setFilterTag(null)}
                        >
                            All
                        </button>
                        {allTags.map((tag) => (
                            <button
                                key={tag}
                                className={`entry-history__tag-filter-btn ${
                                    filterTag === tag
                                        ? "entry-history__tag-filter-btn--active"
                                        : ""
                                }`}
                                onClick={() =>
                                    setFilterTag(filterTag === tag ? null : tag)
                                }
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Desktop Table */}
            <div className="entry-history__table-wrapper">
                <table className="entry-history__table">
                    <thead>
                        <tr>
                            <th
                                className={`entry-history__header entry-history__header--date ${
                                    sortField === "date"
                                        ? `entry-history__header--${sortDirection}`
                                        : ""
                                }`}
                            >
                                <button
                                    onClick={() => handleSort("date")}
                                    className="entry-history__sort-btn"
                                >
                                    Date{" "}
                                    {sortField === "date" &&
                                        (sortDirection === "asc" ? "↑" : "↓")}
                                </button>
                            </th>
                            <th
                                className={`entry-history__header ${
                                    sortField === "position"
                                        ? `entry-history__header--${sortDirection}`
                                        : ""
                                }`}
                            >
                                <button
                                    onClick={() => handleSort("position")}
                                    className="entry-history__sort-btn"
                                >
                                    Position{" "}
                                    {sortField === "position" &&
                                        (sortDirection === "asc" ? "↑" : "↓")}
                                </button>
                            </th>
                            <th className="entry-history__header">Time</th>
                            <th
                                className={`entry-history__header ${
                                    sortField === "hours"
                                        ? `entry-history__header--${sortDirection}`
                                        : ""
                                }`}
                            >
                                <button
                                    onClick={() => handleSort("hours")}
                                    className="entry-history__sort-btn"
                                >
                                    Hours{" "}
                                    {sortField === "hours" &&
                                        (sortDirection === "asc" ? "↑" : "↓")}
                                </button>
                            </th>
                            <th
                                className={`entry-history__header ${
                                    sortField === "rate"
                                        ? `entry-history__header--${sortDirection}`
                                        : ""
                                }`}
                            >
                                <button
                                    onClick={() => handleSort("rate")}
                                    className="entry-history__sort-btn"
                                >
                                    Rate{" "}
                                    {sortField === "rate" &&
                                        (sortDirection === "asc" ? "↑" : "↓")}
                                </button>
                            </th>
                            <th className="entry-history__header">Pay</th>
                            <th className="entry-history__header">Tags</th>
                            <th className="entry-history__header">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEntries.map((entry, idx) => (
                            <EntryHistoryRow
                                key={entry.entryId}
                                entry={entry}
                                index={idx}
                                onEdit={onEditEntry}
                                onDeleteRequest={setDeleteConfirmId}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <DeleteConfirmModal
                    onConfirm={() => void handleDeleteEntry(deleteConfirmId)}
                    onCancel={() => setDeleteConfirmId(null)}
                />
            )}
        </div>
    );
};
