/**
 * Tests for custom hooks
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEntryForm, usePayPeriod, useGrossPayCalculation } from "./hooks";
import { createId } from "@/features/freelance-tracker/contracts/types";

const mockStoreState = vi.hoisted(() => ({
    entries: [],
    organizations: [],
    selectedPeriod: null,
    tagHistories: [],
    positionHistories: [],
    venueHistories: [],
    loading: false,
    error: null,
    isFormOpen: false,
    editingEntryId: null,
    loadOrganizations: vi.fn(),
    loadEntries: vi.fn(),
    loadHistories: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    selectPeriod: vi.fn(),
    setFormOpen: vi.fn(),
    setEditingEntry: vi.fn(),
    setError: vi.fn(),
}));

// Mock store
vi.mock("./store", () => {
    return {
        default: vi.fn((selector?: (state: typeof mockStoreState) => any) =>
            selector ? selector(mockStoreState) : mockStoreState,
        ),
    };
});

// Mock services
vi.mock("@/features/freelance-tracker/data", () => ({
    getDataLayer: vi.fn(() => ({})),
}));

vi.mock("@/features/freelance-tracker/domain/services", () => ({
    PayPeriodService: vi.fn(() => ({
        calculatePayPeriodForDate: vi.fn(async () => ({
            success: true,
            data: {
                startDate: "2026-04-13",
                endDate: "2026-04-19",
            },
        })),
    })),
    GrossPayCalculator: vi.fn(() => ({
        calculateGrossPayForPeriod: vi.fn(async () => ({
            success: true,
            data: {
                totalPay: 1200,
                entriesWithoutRate: 0,
                totalHours: 8,
                breakdown: [],
                cumulativePay: 1200,
            },
        })),
    })),
}));

describe("useEntryForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState.organizations = [];
    });

    it("returns initial values for new entry", () => {
        const { result } = renderHook(() => useEntryForm());

        expect(result.current.initialValues).toBeDefined();
        expect(result.current.initialValues.organizationId).toBe("");
        expect(result.current.initialValues.position).toBe("");
        expect(result.current.initialValues.tags).toEqual([]);
    });

    it("does not infer organizationId for new entries even when organizations exist", () => {
        mockStoreState.organizations = [
            {
                organizationId: createId(),
                name: "Org A",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                venues: [],
                positions: [],
                createdAt: new Date().toISOString(),
            },
        ];

        const { result } = renderHook(() => useEntryForm());

        expect(result.current.initialValues.organizationId).toBe("");
    });

    it("calculates hours correctly", () => {
        const { result } = renderHook(() => useEntryForm());

        const hours = result.current.calculateHours("09:00", "17:00");
        expect(hours).toBe(8);
    });

    it("validates required fields", () => {
        const { result } = renderHook(() => useEntryForm());

        const error = result.current.validateForm({
            dateWorked: "",
            startTime: "09:00",
            endTime: "17:00",
            position: "Tech",
        });

        expect(error).toBe("Date is required");
    });

    it("returns null for valid form", () => {
        const { result } = renderHook(() => useEntryForm());

        const error = result.current.validateForm({
            organizationId: "org-1" as any,
            dateWorked: "2026-04-14",
            startTime: "09:00",
            endTime: "17:00",
            position: "Tech",
        });

        expect(error).toBeNull();
    });

    it("requires flat-fee amount when payment mode is flat-fee", () => {
        const { result } = renderHook(() => useEntryForm());

        const error = result.current.validateForm({
            organizationId: "org-1" as any,
            dateWorked: "2026-04-14",
            startTime: "09:00",
            endTime: "17:00",
            position: "Tech",
            paymentMode: "flat-fee",
            flatFeeAmount: null,
        });

        expect(error).toBe("Flat-fee amount is required");
    });

    it("rejects negative flat-fee amount", () => {
        const { result } = renderHook(() => useEntryForm());

        const error = result.current.validateForm({
            organizationId: "org-1" as any,
            dateWorked: "2026-04-14",
            startTime: "09:00",
            endTime: "17:00",
            position: "Tech",
            paymentMode: "flat-fee",
            flatFeeAmount: -10,
        });

        expect(error).toBe("Flat-fee amount must be 0 or greater");
    });

    it("provides autocomplete functions", () => {
        const { result } = renderHook(() => useEntryForm());

        expect(typeof result.current.autocompleteVenues).toBe("function");
        expect(typeof result.current.autocompletePositions).toBe("function");
        expect(typeof result.current.autocompleteTags).toBe("function");
    });

    it("returns organization-scoped default rate lookups for positions", () => {
        const organizationId = createId();
        const otherOrganizationId = createId();

        mockStoreState.organizations = [
            {
                organizationId,
                name: "Org A",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                positions: [
                    { name: "Sound Tech", defaultRate: 175 },
                    { name: "Deck Chief", defaultRate: null },
                ],
                venues: [],
                createdAt: new Date().toISOString(),
            },
            {
                organizationId: otherOrganizationId,
                name: "Org B",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                positions: [{ name: "Sound Tech", defaultRate: 220 }],
                venues: [],
                createdAt: new Date().toISOString(),
            },
        ];

        const { result } = renderHook(() => useEntryForm());

        expect(
            result.current.getOrganizationPositionDefaultRate(
                "  sound tech ",
                organizationId,
            ),
        ).toBe(175);
        expect(
            result.current.getOrganizationPositionDefaultRate(
                "Deck Chief",
                organizationId,
            ),
        ).toBeNull();
        expect(
            result.current.getOrganizationPositionDefaultRate(
                "Sound Tech",
                otherOrganizationId,
            ),
        ).toBe(220);
    });
});

describe("usePayPeriod", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns pay period utilities", () => {
        const { result } = renderHook(() => usePayPeriod());

        expect(result.current.selectedPeriod).toBeDefined();
        expect(typeof result.current.calculatePayPeriodForToday).toBe(
            "function",
        );
        expect(typeof result.current.setCustomPeriod).toBe("function");
        expect(typeof result.current.getPeriodLabel).toBe("function");
    });

    it("provides period label formatting", () => {
        const { result } = renderHook(() => usePayPeriod());

        const label = result.current.getPeriodLabel();
        expect(typeof label).toBe("string");
    });
});

describe("useGrossPayCalculation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns calculation function", () => {
        const { result } = renderHook(() => useGrossPayCalculation());

        expect(typeof result.current.calculateGrossPay).toBe("function");
    });

    it("calculates gross pay", async () => {
        const { result } = renderHook(() => useGrossPayCalculation());

        const orgId = createId();
        const payResult = await result.current.calculateGrossPay(orgId, {
            startDate: "2026-04-13",
            endDate: "2026-04-19",
        });

        expect(payResult.success).toBe(true);
    });
});
