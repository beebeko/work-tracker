import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryHistory } from "../EntryHistory";
import { makeEntry, testId } from "../../../test-utils/fixtures";

const deleteEntry = vi.fn();
const loadEntries = vi.fn();
const selectPeriod = vi.fn();
const selectedOrganizationId = testId("org");

const getExpectedThisMonth = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
        startDate: new Date(today.getFullYear(), today.getMonth(), 1)
            .toISOString()
            .split("T")[0],
        endDate: new Date(today.getFullYear(), today.getMonth() + 1, 0)
            .toISOString()
            .split("T")[0],
    };
};

const getExpectedThisWeek = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - dayOfWeek);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    return {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
    };
};

const entries = [
    makeEntry({
        entryId: testId("entry"),
        organizationId: selectedOrganizationId,
        dateWorked: "2026-04-14",
        position: "Audio",
        tags: ["festival"],
        rate: 20,
    }),
    makeEntry({
        entryId: testId("entry"),
        organizationId: selectedOrganizationId,
        dateWorked: "2026-04-15",
        position: "Video",
        tags: ["corporate"],
        rate: 40,
    }),
    makeEntry({
        entryId: testId("entry"),
        organizationId: selectedOrganizationId,
        dateWorked: "2026-04-16",
        position: "Lighting",
        tags: ["festival"],
        rate: null,
    }),
];

const store: any = {
    organizations: [
        {
            organizationId: selectedOrganizationId,
            name: "Org A",
            payPeriodStartDay: 1,
            createdAt: new Date().toISOString(),
        },
        {
            organizationId: testId("org"),
            name: "Org B",
            payPeriodStartDay: 1,
            createdAt: new Date().toISOString(),
        },
    ],
    entries,
    selectedPeriod: null,
    loadEntries,
    selectPeriod,
    deleteEntry,
};

vi.mock("../../hooks", () => ({
    useFreelanceTracker: () => store,
}));

describe("EntryHistory integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));
        deleteEntry.mockResolvedValue({ success: true, data: undefined });
        store.entries = entries;
        store.selectedPeriod = getExpectedThisMonth();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("defaults the history selector to This Month", async () => {
        render(<EntryHistory />);

        const periodGroup = screen.getByRole("group", {
            name: /history period/i,
        });

        await waitFor(() => {
            expect(
                within(periodGroup).getByRole("button", {
                    name: /this month/i,
                }),
            ).toHaveClass("period-selector__button--active");
            expect(selectPeriod).toHaveBeenCalledWith(
                getExpectedThisMonth().startDate,
                getExpectedThisMonth().endDate,
            );
        });
    });

    it("changes the store-backed history period independently", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);

        selectPeriod.mockClear();

        const periodGroup = screen.getByRole("group", {
            name: /history period/i,
        });
        await user.click(
            within(periodGroup).getByRole("button", { name: /this week/i }),
        );

        expect(selectPeriod).toHaveBeenCalledWith(
            getExpectedThisWeek().startDate,
            getExpectedThisWeek().endDate,
        );
    });

    it("renders entries and sort controls", async () => {
        const user = userEvent.setup();
        store.selectedPeriod = getExpectedThisMonth();

        render(<EntryHistory />);

        await user.click(
            screen.getByRole("checkbox", {
                name: /filter by organization/i,
            }),
        );

        expect(
            screen.getByRole("button", { name: /date/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /position/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /^rate/i }),
        ).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(
            3,
        );
        await waitFor(() => {
            expect(loadEntries).toHaveBeenCalledWith(selectedOrganizationId, {
                startDate: getExpectedThisMonth().startDate,
                endDate: getExpectedThisMonth().endDate,
            });
        });
    });

    it("filters by tag and clears filter", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);

        await user.click(
            screen.getByRole("checkbox", {
                name: /filter by organization/i,
            }),
        );

        await user.click(screen.getByRole("button", { name: "festival" }));
        expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(
            2,
        );

        await user.click(screen.getByRole("button", { name: "All" }));
        expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(
            3,
        );
    });

    it("fires edit callback for selected row", async () => {
        const user = userEvent.setup();
        const onEditEntry = vi.fn();
        render(<EntryHistory onEditEntry={onEditEntry} />);

        await user.click(
            screen.getByRole("checkbox", {
                name: /filter by organization/i,
            }),
        );

        const editButtons = screen.getAllByRole("button", { name: /edit/i });
        await user.click(editButtons[0]);

        expect(onEditEntry).toHaveBeenCalledTimes(1);
    });

    it("shows delete confirmation and deletes on confirm", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);

        await user.click(
            screen.getByRole("checkbox", {
                name: /filter by organization/i,
            }),
        );

        await user.click(screen.getAllByRole("button", { name: /delete/i })[0]);
        expect(screen.getByText(/delete entry/i)).toBeInTheDocument();

        const modal = screen.getByText(/delete entry/i).closest("div");
        expect(modal).not.toBeNull();

        await user.click(
            within(modal as HTMLElement).getByRole("button", {
                name: /^delete$/i,
            }),
        );
        expect(deleteEntry).toHaveBeenCalledTimes(1);
    });

    it("canceling delete keeps list unchanged", async () => {
        const user = userEvent.setup();
        render(<EntryHistory />);

        await user.click(
            screen.getByRole("checkbox", {
                name: /filter by organization/i,
            }),
        );

        await user.click(screen.getAllByRole("button", { name: /delete/i })[0]);
        await user.click(screen.getByRole("button", { name: /cancel/i }));

        expect(deleteEntry).not.toHaveBeenCalled();
        expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(
            3,
        );
    });

    it("renders zero-duration flat-fee entries with badge, row styling, and $0.00/hr effective rate", () => {
        store.entries = [
            makeEntry({
                entryId: testId("entry"),
                organizationId: selectedOrganizationId,
                dateWorked: "2026-04-16",
                position: "Flat Fee Zero Duration",
                startTime: "10:00",
                endTime: "10:00",
                paymentMode: "flat-fee",
                flatFeeAmount: 120,
                rate: null,
                tags: ["festival"],
            }),
        ];
        store.selectedPeriod = getExpectedThisMonth();

        render(<EntryHistory />);

        return waitFor(() => {
            const row = screen
                .getByText("Flat Fee Zero Duration")
                .closest("tr") as HTMLElement;
            expect(row).toHaveClass("entry-history__row--flat-fee");
            expect(screen.getByText("Flat Fee")).toBeInTheDocument();
            expect(screen.getByText("$0.00/hr")).toBeInTheDocument();
        });
    });
});
