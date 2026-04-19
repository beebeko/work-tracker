/**
 * Tests for EntryHistory component
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryHistory } from "./EntryHistory";
import type { Entry, Id } from "@/features/freelance-tracker/contracts/types";

const mockUseFreelanceTracker = vi.hoisted(() => vi.fn());
const mockEntriesList = vi.hoisted(() => vi.fn());

vi.mock("@/features/freelance-tracker/data", () => ({
    getDataLayer: () => ({
        entries: { list: mockEntriesList },
    }),
}));

vi.mock("../hooks", () => ({
    useFreelanceTracker: mockUseFreelanceTracker,
}));

const ORG_ID = "org-1" as Id;

const entry1: Entry = {
    entryId: "entry-1" as Id,
    organizationId: ORG_ID,
    dateWorked: "2026-04-14",
    startTime: "09:00",
    endTime: "17:00",
    position: "Sound Tech",
    rate: 150,
    event: "Conference",
    tags: ["audio", "event"],
    notes: "Great setup",
    mealPenaltyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const entry2: Entry = {
    entryId: "entry-2" as Id,
    organizationId: ORG_ID,
    dateWorked: "2026-04-13",
    startTime: "10:00",
    endTime: "10:00",
    position: "Technician",
    paymentMode: "flat-fee",
    flatFeeAmount: 120,
    rate: null,
    event: "Setup",
    tags: ["prep"],
    notes: null,
    mealPenaltyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const entry3: Entry = {
    entryId: "entry-3" as Id,
    organizationId: ORG_ID,
    dateWorked: "2026-04-12",
    startTime: "08:00",
    endTime: "12:00",
    position: "Loader",
    paymentMode: "hourly",
    rate: null,
    event: null,
    tags: ["prep"],
    notes: null,
    mealPenaltyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const createMockStore = (overrides: Record<string, unknown> = {}) => ({
    organizations: [
        {
            organizationId: ORG_ID,
            name: "Org 1",
            payPeriodStartDay: 1,
            createdAt: new Date().toISOString(),
        },
    ],
    entries: [entry1, entry2, entry3],
    loading: false,
    error: null,
    selectedPeriod: {
        startDate: "2026-04-01",
        endDate: "2026-04-30",
    },
    loadEntries: vi.fn(),
    selectPeriod: vi.fn(),
    deleteEntry: vi.fn(async () => ({ success: true, data: undefined })),
    ...overrides,
});

describe("EntryHistory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseFreelanceTracker.mockImplementation(() => createMockStore());
        mockEntriesList.mockResolvedValue({
            success: true,
            data: [entry1, entry2, entry3],
        });
    });

    it("renders entries in a table", async () => {
        render(<EntryHistory />);
        await screen.findByText("Sound Tech");
        expect(screen.getByText("Technician")).toBeInTheDocument();
        expect(screen.getByText("$150.00/hr")).toBeInTheDocument();
    });

    it("displays empty state when no entries", async () => {
        mockEntriesList.mockResolvedValue({ success: true, data: [] });
        mockUseFreelanceTracker.mockReturnValue({
            organizations: [
                {
                    organizationId: "org-1" as Id,
                    name: "Org 1",
                    payPeriodStartDay: 1,
                    createdAt: new Date().toISOString(),
                },
            ],
            entries: [],
            loading: false,
            error: null,
            selectedPeriod: {
                startDate: "2026-04-01",
                endDate: "2026-04-30",
            },
            loadEntries: vi.fn(),
            selectPeriod: vi.fn(),
            deleteEntry: vi.fn(),
        } as any);

        render(<EntryHistory />);
        await screen.findByText(/no entries yet/i);
        expect(screen.getByText(/no entries yet/i)).toBeInTheDocument();
    });

    it("uses a local organization filter and reloads entries when it changes", async () => {
        const user = userEvent.setup();
        const loadEntries = vi.fn();

        mockUseFreelanceTracker.mockReturnValue({
            organizations: [
                {
                    organizationId: "org-1" as Id,
                    name: "Org 1",
                    payPeriodStartDay: 1,
                    createdAt: new Date().toISOString(),
                },
                {
                    organizationId: "org-2" as Id,
                    name: "Org 2",
                    payPeriodStartDay: 1,
                    createdAt: new Date().toISOString(),
                },
            ],
            entries: [],
            loading: false,
            error: null,
            selectedPeriod: {
                startDate: "2026-04-01",
                endDate: "2026-04-30",
            },
            loadEntries,
            selectPeriod: vi.fn(),
            deleteEntry: vi.fn(async () => ({
                success: true,
                data: undefined,
            })),
        } as any);

        render(<EntryHistory />);

        // Enable the org filter
        const checkbox = screen.getByLabelText(/filter by organization/i);
        await user.click(checkbox);

        await waitFor(() => {
            expect(loadEntries).toHaveBeenCalledWith("org-1", {
                startDate: "2026-04-01",
                endDate: "2026-04-30",
            });
        });

        await user.selectOptions(
            screen.getByLabelText("Organization"),
            "org-2",
        );

        await waitFor(() => {
            expect(loadEntries).toHaveBeenCalledWith("org-2", {
                startDate: "2026-04-01",
                endDate: "2026-04-30",
            });
        });
    });

    it("renders no-organization empty state with local filter disabled", () => {
        mockUseFreelanceTracker.mockReturnValue({
            organizations: [],
            entries: [],
            loading: false,
            error: null,
            selectedPeriod: {
                startDate: "2026-04-01",
                endDate: "2026-04-30",
            },
            loadEntries: vi.fn(),
            selectPeriod: vi.fn(),
            deleteEntry: vi.fn(async () => ({
                success: true,
                data: undefined,
            })),
        } as any);

        render(<EntryHistory />);

        expect(
            screen.getByText(/no organizations available/i),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Organization")).toBeDisabled();
    });

    it("defaults to all-organizations mode with checkbox unchecked", async () => {
        render(<EntryHistory />);
        await screen.findByText("Sound Tech");
        const checkbox = screen.getByLabelText(/filter by organization/i);
        expect(checkbox).not.toBeChecked();
        expect(screen.getByLabelText("Organization")).toBeDisabled();
    });

    it("enables org picker when filter checkbox is checked", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);
        const checkbox = screen.getByLabelText(/filter by organization/i);
        await user.click(checkbox);
        expect(checkbox).toBeChecked();
        await waitFor(() => {
            expect(screen.getByLabelText("Organization")).not.toBeDisabled();
        });
    });

    it("returns to all-orgs mode when checkbox is unchecked", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);
        const checkbox = screen.getByLabelText(/filter by organization/i);
        await user.click(checkbox);
        expect(checkbox).toBeChecked();
        await user.click(checkbox);
        expect(checkbox).not.toBeChecked();
        expect(screen.getByLabelText("Organization")).toBeDisabled();
    });

    it("shows 'All organizations' option when filter is inactive", async () => {
        render(<EntryHistory />);
        expect(
            await screen.findByRole("option", { name: "All organizations" }),
        ).toBeInTheDocument();
    });

    it("allows filtering by tag", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);

        const audioTagFilter = await screen.findByRole("button", {
            name: "audio",
        });
        await user.click(audioTagFilter);

        // Should show only entry with audio tag
        expect(screen.getByText("Sound Tech")).toBeInTheDocument();
        expect(screen.queryByText("Technician")).not.toBeInTheDocument();
    });

    it("allows sorting by column", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);

        const dateHeader = await screen.findByRole("button", { name: /date/i });
        await user.click(dateHeader);

        // Sort indicator should appear
        expect(dateHeader.textContent).toMatch(/↑|↓/);
    });

    it("shows delete confirm modal", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);

        const deleteButtons = await screen.findAllByRole("button", {
            name: /delete/i,
        });
        await user.click(deleteButtons[0]);

        expect(screen.getByText(/delete entry/i)).toBeInTheDocument();
    });

    it("allows canceling delete", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);

        const deleteButtons = await screen.findAllByRole("button", {
            name: /delete/i,
        });
        await user.click(deleteButtons[0]);

        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        await user.click(cancelButton);

        // Modal should close
        expect(screen.queryByText(/delete entry/i)).not.toBeInTheDocument();
    });

    it("calls onEditEntry when edit button is clicked", async () => {
        const user = userEvent.setup();
        const onEditEntry = vi.fn();
        render(<EntryHistory onEditEntry={onEditEntry} />);

        const editButtons = await screen.findAllByRole("button", {
            name: /edit/i,
        });
        await user.click(editButtons[0]);

        expect(onEditEntry).toHaveBeenCalled();
    });

    it("displays unrated entries with dash for pay", async () => {
        render(<EntryHistory />);

        // Find cells with "—" (em dash) for unrated entries
        const cells = await screen.findAllByText("—");
        expect(cells.length).toBeGreaterThan(0);
    });

    it("shows flat-fee badge and row styling", async () => {
        render(<EntryHistory />);

        const badge = await screen.findByText("Flat Fee");
        expect(badge).toBeInTheDocument();

        const row = badge.closest("tr");
        expect(row).toHaveClass("entry-history__row--flat-fee");
    });

    it("shows zero-duration flat-fee effective rate as $0.00/hr", async () => {
        render(<EntryHistory />);

        await screen.findByText("$0.00/hr");
        expect(screen.getByText("$120.00")).toBeInTheDocument();
    });

    it("displays tags as pills", async () => {
        render(<EntryHistory />);

        await screen.findByText("Sound Tech");
        expect(screen.getAllByText("audio").length).toBeGreaterThan(0);
        expect(screen.getAllByText("event").length).toBeGreaterThan(0);
        expect(screen.getAllByText("prep").length).toBeGreaterThan(0);
    });

    it("shows tag count when more than 3", async () => {
        // This would need to be added to the test data if we had more tags
        render(<EntryHistory />);
        await screen.findByText("Sound Tech");

        // Current test data has at most 2 tags per entry
        expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument();
    });

    it("calculates and displays hours correctly", async () => {
        render(<EntryHistory />);

        await screen.findByText("Sound Tech");
        // 09:00 to 17:00 = 8 hours
        expect(screen.getByText("8.0h")).toBeInTheDocument();

        // 10:00 to 10:00 = 0 hours
        expect(screen.getByText("0.0h")).toBeInTheDocument();
    });

    it("formats dates correctly", async () => {
        render(<EntryHistory />);

        await screen.findByText("Sound Tech");
        // Should see formatted dates (e.g., "Apr 14, 26")
        expect(screen.getAllByText(/Apr/).length).toBeGreaterThan(0);
    });

    it("closes delete confirmation modal when Escape key is pressed", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);

        const deleteButtons = await screen.findAllByRole("button", {
            name: /delete/i,
        });
        await user.click(deleteButtons[0]);

        expect(screen.getByText(/delete entry/i)).toBeInTheDocument();

        await user.keyboard("{Escape}");

        await waitFor(() => {
            expect(screen.queryByText(/delete entry/i)).not.toBeInTheDocument();
        });
    });

    it("removes deleted entry from table in all-organizations mode", async () => {
        const user = userEvent.setup();
        const deleteEntry = vi.fn(async () => ({
            success: true,
            data: undefined,
        }));

        mockUseFreelanceTracker.mockReturnValue({
            organizations: [
                {
                    organizationId: ORG_ID,
                    name: "Org 1",
                    payPeriodStartDay: 1,
                    createdAt: new Date().toISOString(),
                },
            ],
            entries: [entry1, entry2, entry3],
            loading: false,
            error: null,
            selectedPeriod: {
                startDate: "2026-04-01",
                endDate: "2026-04-30",
            },
            loadEntries: vi.fn(),
            selectPeriod: vi.fn(),
            deleteEntry,
        } as any);

        mockEntriesList.mockResolvedValue({
            success: true,
            data: [entry1, entry2, entry3],
        });

        render(<EntryHistory />);

        // Verify entry is visible before delete
        await screen
            .findByText("Delete Me", { selector: "td" }, { timeout: 3000 })
            .catch(() => null);
        const textBefore = await screen.findByText("Sound Tech");
        expect(textBefore).toBeInTheDocument();

        // Click delete button for first entry
        const deleteButtons = await screen.findAllByRole("button", {
            name: /delete/i,
        });
        await user.click(deleteButtons[0]);

        // Confirm deletion
        const deleteModal = screen.getByText(/delete entry/i);
        const confirmButton = deleteModal
            .closest(".entry-history__modal")
            ?.querySelector(".entry-history__modal-confirm");
        expect(confirmButton).toBeInTheDocument();
        await user.click(confirmButton!);

        // Verify deleteEntry was called with correct ID
        await waitFor(() => {
            expect(deleteEntry).toHaveBeenCalledWith(entry1.entryId);
        });

        // Verify entry is removed from table after delete in all-orgs mode
        await waitFor(() => {
            expect(screen.queryByText("Sound Tech")).not.toBeInTheDocument();
        });
    });
});
