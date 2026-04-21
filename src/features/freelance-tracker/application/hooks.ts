/**
 * Custom hooks for Freelance Tracker
 */

import { useCallback, useMemo } from "react";
import useFreelanceTrackerStore from "./store";
import {
    PayPeriodService,
    GrossPayCalculator,
} from "@/features/freelance-tracker/domain/services";
import { getDataLayer } from "@/features/freelance-tracker/data";
import type {
    Entry,
    Id,
    Organization,
    Result,
} from "@/features/freelance-tracker/contracts/types";
import { err, isOk, ok } from "@/features/freelance-tracker/contracts/types";

const normalizeCatalogName = (value: string): string =>
    value.trim().replace(/\s+/g, " ");

const normalizeCatalogKey = (value: string): string =>
    normalizeCatalogName(value).toLowerCase();

export type EmployerPeriodAggregate = {
    organizationId: Id;
    employerName: string;
    hours: number;
    earnings: number;
    entryCount: number;
};

const toMinutes = (value: string): number => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
};

const calculateEntryHours = (entry: Pick<Entry, "startTime" | "endTime">) => {
    return (toMinutes(entry.endTime) - toMinutes(entry.startTime)) / 60;
};

const calculateEntryEarnings = (
    entry: Pick<Entry, "paymentMode" | "flatFeeAmount" | "rate">,
    hours: number,
): number => {
    if (entry.paymentMode === "flat-fee") {
        return typeof entry.flatFeeAmount === "number"
            ? entry.flatFeeAmount
            : 0;
    }

    return typeof entry.rate === "number" ? hours * entry.rate : 0;
};

/**
 * useFreelanceTracker - Access to full store and actions
 */
export const useFreelanceTracker = () => {
    return useFreelanceTrackerStore();
};

/**
 * useEntryForm - Form-specific logic and handlers
 */
export const useEntryForm = (editingEntryId?: Id | null) => {
    const store = useFreelanceTrackerStore();

    const editingEntry = useMemo(() => {
        if (!editingEntryId) return null;
        return store.entries.find((e) => e.entryId === editingEntryId) || null;
    }, [editingEntryId, store.entries]);

    const initialValues = useMemo<
        Omit<Entry, "entryId" | "createdAt" | "updatedAt">
    >(() => {
        if (editingEntry) {
            return {
                organizationId: editingEntry.organizationId,
                dateWorked: editingEntry.dateWorked,
                startTime: editingEntry.startTime,
                endTime: editingEntry.endTime,
                venue: editingEntry.venue,
                position: editingEntry.position,
                rate: editingEntry.rate,
                paymentMode: editingEntry.paymentMode ?? "hourly",
                flatFeeAmount: editingEntry.flatFeeAmount ?? null,
                event: editingEntry.event,
                tags: editingEntry.tags,
                notes: editingEntry.notes,
                mealPenaltyCount: editingEntry.mealPenaltyCount ?? 0,
            };
        }
        return {
            organizationId: "" as Id,
            dateWorked: new Date().toISOString().split("T")[0],
            startTime: "09:00",
            endTime: "17:00",
            venue: null,
            position: "",
            rate: null,
            paymentMode: "hourly",
            flatFeeAmount: null,
            event: null,
            tags: [],
            notes: null,
            mealPenaltyCount: 0,
        };
    }, [editingEntry]);

    const calculateHours = useCallback(
        (startTime: string, endTime: string): number => {
            const [sHours, sMins] = startTime.split(":").map(Number);
            const [eHours, eMins] = endTime.split(":").map(Number);
            const startMinutes = sHours * 60 + sMins;
            const endMinutes = eHours * 60 + eMins;
            return (endMinutes - startMinutes) / 60;
        },
        [],
    );

    const validateForm = useCallback(
        (data: Partial<typeof initialValues>): string | null => {
            if (!data.dateWorked) return "Date is required";
            if (!data.startTime) return "Start time is required";
            if (!data.endTime) return "End time is required";
            if (!data.position) return "Position is required";
            if (!data.organizationId) return "Organization is required";

            const hours = calculateHours(data.startTime, data.endTime);
            if (hours <= 0) return "End time must be after start time";

            const paymentMode = data.paymentMode ?? "hourly";
            if (paymentMode === "flat-fee") {
                if (
                    data.flatFeeAmount === null ||
                    data.flatFeeAmount === undefined
                ) {
                    return "Flat-fee amount is required";
                }

                if (
                    !Number.isFinite(data.flatFeeAmount) ||
                    Number(data.flatFeeAmount) < 0
                ) {
                    return "Flat-fee amount must be 0 or greater";
                }
            }

            return null;
        },
        [calculateHours],
    );

    const autocompleteVenues = useCallback(
        (searchTerm: string, orgId: Id): string[] => {
            const normalized = searchTerm.toLowerCase();
            const organization = store.organizations.find(
                (candidate) => candidate.organizationId === orgId,
            );
            const catalogVenues = organization ? organization.venues : [];
            const historyVenues = store.venueHistories
                .filter((venue) => venue.organizationId === orgId)
                .map((venue) => venue.venueName);

            return [...catalogVenues, ...historyVenues]
                .filter(
                    (venue, index, venues) =>
                        venues.findIndex(
                            (candidate) =>
                                normalizeCatalogKey(candidate) ===
                                normalizeCatalogKey(venue),
                        ) === index,
                )
                .filter((venue) => venue.toLowerCase().includes(normalized))
                .slice(0, 10);
        },
        [store.organizations, store.venueHistories],
    );

    const autocompletePositions = useCallback(
        (searchTerm: string, orgId: Id): string[] => {
            const normalized = searchTerm.toLowerCase();
            const organization = store.organizations.find(
                (candidate) => candidate.organizationId === orgId,
            );
            const catalogPositions = (
                organization ? organization.positions : []
            ).map((position) => position.name);
            const historyPositions = store.positionHistories
                .filter(
                    (p) =>
                        p.organizationId === orgId &&
                        p.position.toLowerCase().includes(normalized),
                )
                .map((p) => p.position);

            return [...catalogPositions, ...historyPositions]
                .filter(
                    (position, index, positions) =>
                        positions.findIndex(
                            (candidate) =>
                                normalizeCatalogKey(candidate) ===
                                normalizeCatalogKey(position),
                        ) === index,
                )
                .filter((position) =>
                    position.toLowerCase().includes(normalized),
                )
                .slice(0, 10);
        },
        [store.organizations, store.positionHistories],
    );

    const getOrganizationPositionDefaultRate = useCallback(
        (positionName: string, orgId: Id): number | null => {
            const organization = store.organizations.find(
                (candidate) => candidate.organizationId === orgId,
            );

            const match = organization?.positions.find(
                (position) =>
                    normalizeCatalogKey(position.name) ===
                    normalizeCatalogKey(positionName),
            );

            return typeof match?.defaultRate === "number"
                ? match.defaultRate
                : null;
        },
        [store.organizations],
    );

    const autocompleteTags = useCallback(
        (searchTerm: string): string[] => {
            const normalized = searchTerm.toLowerCase();
            return store.tagHistories
                .filter((t) => t.tag.toLowerCase().includes(normalized))
                .map((t) => t.tag)
                .slice(0, 10);
        },
        [store.tagHistories],
    );

    return {
        editingEntry,
        initialValues,
        calculateHours,
        validateForm,
        autocompleteVenues,
        autocompletePositions,
        getOrganizationPositionDefaultRate,
        autocompleteTags,
    };
};

/**
 * usePayPeriod - Pay period selection and calculation
 */
export const usePayPeriod = () => {
    const selectedPeriod = useFreelanceTrackerStore(
        (state) => state.selectedPeriod,
    );
    const selectPeriod = useFreelanceTrackerStore(
        (state) => state.selectPeriod,
    );
    const dal = getDataLayer();

    const payPeriodService = useMemo(() => {
        return new PayPeriodService({ dal });
    }, [dal]);

    const calculatePayPeriodForToday = useCallback(
        async (organizationId?: Id | null) => {
            if (!organizationId) return;

            const today = new Date().toISOString().split("T")[0];
            const result = await payPeriodService.calculatePayPeriodForDate(
                today,
                organizationId,
            );

            if (isOk(result)) {
                selectPeriod(result.data.startDate, result.data.endDate);
            }
        },
        [payPeriodService, selectPeriod],
    );

    const setCustomPeriod = useCallback(
        (startDate: string, endDate: string) => {
            selectPeriod(startDate, endDate);
        },
        [selectPeriod],
    );

    const getPeriodLabel = useCallback((): string => {
        if (!selectedPeriod) return "No period selected";

        const start = new Date(selectedPeriod.startDate);
        const end = new Date(selectedPeriod.endDate);
        const sameMonth =
            start.getMonth() === end.getMonth() &&
            start.getFullYear() === end.getFullYear();

        const formatter = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: sameMonth ? undefined : "numeric",
        });

        if (sameMonth) {
            return `${formatter.format(start)} – ${new Intl.DateTimeFormat(
                "en-US",
                {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                },
            ).format(end)}`;
        }

        return `${formatter.format(start)} – ${new Intl.DateTimeFormat(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year: "numeric",
            },
        ).format(end)}`;
    }, [selectedPeriod]);

    return useMemo(
        () => ({
            selectedPeriod,
            calculatePayPeriodForToday,
            setCustomPeriod,
            getPeriodLabel,
        }),
        [
            selectedPeriod,
            calculatePayPeriodForToday,
            setCustomPeriod,
            getPeriodLabel,
        ],
    );
};

/**
 * useGrossPayCalculation - Gross pay calculation with caching
 */
export const useGrossPayCalculation = () => {
    const dal = getDataLayer();

    const calculator = useMemo(() => {
        return new GrossPayCalculator({ dal });
    }, [dal]);

    const calculateGrossPay = useCallback(
        async (orgId: Id, period: { startDate: string; endDate: string }) => {
            const result = await calculator.calculateGrossPayForPeriod(
                orgId,
                period,
            );
            return result;
        },
        [calculator],
    );

    return useMemo(
        () => ({
            calculateGrossPay,
        }),
        [calculateGrossPay],
    );
};

/**
 * useEmployerPeriodAggregation - Aggregate period totals grouped by employer
 */
export const useEmployerPeriodAggregation = () => {
    const dal = getDataLayer();

    const calculateByEmployerForPeriod = useCallback(
        async (
            organizations: Organization[],
            period: { startDate: string; endDate: string },
        ): Promise<Result<EmployerPeriodAggregate[]>> => {
            const uniqueOrganizations = organizations.filter(
                (organization, index, all) =>
                    all.findIndex(
                        (candidate) =>
                            candidate.organizationId ===
                            organization.organizationId,
                    ) === index,
            );

            const summaries = await Promise.all(
                uniqueOrganizations.map(async (organization) => {
                    const entriesResult = await dal.entries.list({
                        organizationId: organization.organizationId,
                        startDate: period.startDate,
                        endDate: period.endDate,
                    });

                    if (!isOk(entriesResult)) {
                        return {
                            organizationId: organization.organizationId,
                            error: entriesResult.error,
                        };
                    }

                    let hours = 0;
                    let earnings = 0;

                    for (const entry of entriesResult.data) {
                        const entryHours = calculateEntryHours(entry);
                        hours += entryHours;
                        earnings += calculateEntryEarnings(entry, entryHours);
                    }

                    return {
                        organizationId: organization.organizationId,
                        employerName: organization.name,
                        hours,
                        earnings,
                        entryCount: entriesResult.data.length,
                    };
                }),
            );

            const failedSummary = summaries.find(
                (
                    summary,
                ): summary is {
                    organizationId: Id;
                    error: Parameters<typeof err>[0];
                } => "error" in summary,
            );

            if (failedSummary) {
                return err(failedSummary.error);
            }

            return ok(
                summaries
                    .filter(
                        (summary): summary is EmployerPeriodAggregate =>
                            "employerName" in summary,
                    )
                    .filter(
                        (summary) =>
                            summary.entryCount > 0 ||
                            summary.hours > 0 ||
                            summary.earnings > 0,
                    ),
            );
        },
        [dal],
    );

    return useMemo(
        () => ({
            calculateByEmployerForPeriod,
        }),
        [calculateByEmployerForPeriod],
    );
};
