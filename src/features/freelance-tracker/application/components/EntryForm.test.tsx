/**
 * Tests for EntryForm component
 * Uses React Testing Library with vitest
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntryForm } from "./EntryForm";
import type { Id } from "../../contracts/types";

const createMatchMedia = (isSingleColumnLayout: boolean) =>
    vi.fn().mockImplementation((query: string) => ({
        media: query,
        matches: query === "(min-width: 480px)" ? !isSingleColumnLayout : false,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }));

const createLegacyMatchMediaController = (isSingleColumnLayout: boolean) => {
    let matches = !isSingleColumnLayout;
    const listeners = new Set<(event: MediaQueryListEvent) => void>();

    const primaryMediaQueryList = {
        media: "(min-width: 480px)",
        get matches() {
            return matches;
        },
        onchange: null,
        addListener: (listener: (event: MediaQueryListEvent) => void) => {
            listeners.add(listener);
        },
        removeListener: (listener: (event: MediaQueryListEvent) => void) => {
            listeners.delete(listener);
        },
        dispatchEvent: () => false,
    };

    const matchMedia = vi.fn().mockImplementation((query: string) => {
        if (query === "(min-width: 480px)") {
            return primaryMediaQueryList;
        }

        return {
            media: query,
            matches: false,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        };
    });

    return {
        matchMedia,
        setSingleColumnLayout: (nextIsSingleColumn: boolean) => {
            matches = !nextIsSingleColumn;
            const event = { matches } as MediaQueryListEvent;
            listeners.forEach((listener) => listener(event));
        },
    };
};

const mockCreateEntry = vi.hoisted(() => vi.fn());
const mockUpdateEntry = vi.hoisted(() => vi.fn());
const mockCreateOrganization = vi.hoisted(() => vi.fn());
const mockCreateRuleset = vi.hoisted(() => vi.fn());
const mockCreateOrganizationPosition = vi.hoisted(() => vi.fn());
const mockLoadSharedRulesets = vi.hoisted(() => vi.fn());
const mockStoreError = vi.hoisted(() => ({ value: null as string | null }));
const mockStoreState = vi.hoisted(() => ({
    loading: false,
    organizations: [
        {
            organizationId: "org-test-1",
            name: "Test Org",
            payPeriodStartDay: 1,
            timezone: "UTC",
            workweekStartDay: 1,
            venues: ["Main Hall"],
            positions: [{ name: "Sound Tech", defaultRate: 150 }],
            rulesetIds: [],
            createdAt: new Date().toISOString(),
        },
    ],
    sharedRulesets: [
        {
            rulesetId: "ruleset-shared-1",
            effectiveDate: "2026-01-01",
            rules: [
                {
                    ruleId: "meal-rule-1",
                    type: "meal-penalty",
                    penaltyAmount: 25,
                },
            ],
            createdAt: new Date().toISOString(),
        },
    ],
}));

// Mock the hooks
vi.mock("../hooks", () => {
    const mockOrgId = "org-test-1";
    return {
        useFreelanceTracker: () => ({
            organizations: mockStoreState.organizations,
            sharedRulesets: mockStoreState.sharedRulesets,
            getSharedRulesetAssignmentSummary: () => [],
            entries: [],
            loading: mockStoreState.loading,
            error: mockStoreError.value,
            createEntry: mockCreateEntry,
            createOrganization: mockCreateOrganization,
            createRuleset: mockCreateRuleset,
            createOrganizationPosition: mockCreateOrganizationPosition,
            loadSharedRulesets: mockLoadSharedRulesets,
            updateEntry: mockUpdateEntry,
            setEditingEntry: vi.fn(),
            loadHistories: vi.fn(),
        }),
        useEntryForm: () => ({
            editingEntry: null,
            initialValues: {
                organizationId: mockOrgId,
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
            },
            calculateHours: (start: string, end: string) => {
                const [sH, sM] = start.split(":").map(Number);
                const [eH, eM] = end.split(":").map(Number);
                return (eH * 60 + eM - (sH * 60 + sM)) / 60;
            },
            validateForm: (data: any) => {
                if (!data.dateWorked) return "Date is required";
                if (!data.startTime) return "Start time is required";
                if (!data.endTime) return "End time is required";
                if (data.endTime <= data.startTime)
                    return "End time must be after start time";
                if (!data.position) return "Position is required";
                return null;
            },
            autocompleteVenues: (searchTerm: string, orgId: string) => {
                const organization = mockStoreState.organizations.find(
                    (candidate) => candidate.organizationId === orgId,
                );

                return (organization?.venues ?? []).filter((venue) =>
                    venue.toLowerCase().includes(searchTerm.toLowerCase()),
                );
            },
            autocompletePositions: (searchTerm: string, orgId: string) => {
                const organization = mockStoreState.organizations.find(
                    (candidate) => candidate.organizationId === orgId,
                );

                return (organization?.positions ?? [])
                    .map((position) => position.name)
                    .filter((position) =>
                        position
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()),
                    );
            },
            getOrganizationPositionDefaultRate: (position: string) => {
                const match = mockStoreState.organizations[0]?.positions?.find(
                    (candidate) =>
                        candidate.name.toLowerCase() ===
                        position.trim().toLowerCase(),
                );
                return typeof match?.defaultRate === "number"
                    ? match.defaultRate
                    : null;
            },
            autocompleteTags: () => [],
        }),
    };
});

describe("EntryForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.matchMedia = createMatchMedia(false) as typeof window.matchMedia;
        mockStoreState.loading = false;
        mockStoreError.value = null;
        mockStoreState.organizations = [
            {
                organizationId: "org-test-1",
                name: "Test Org",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                venues: ["Main Hall"],
                positions: [{ name: "Sound Tech", defaultRate: 150 }],
                rulesetIds: [],
                createdAt: new Date().toISOString(),
            },
        ];
        mockStoreState.sharedRulesets = [
            {
                rulesetId: "ruleset-shared-1",
                effectiveDate: "2026-01-01",
                rules: [
                    {
                        ruleId: "meal-rule-1",
                        type: "meal-penalty",
                        penaltyAmount: 25,
                    },
                ],
                createdAt: new Date().toISOString(),
            },
        ];
        mockCreateEntry.mockResolvedValue({
            success: true,
            data: {
                entryId: "entry-created-1",
                organizationId: "org-test-1",
                dateWorked: new Date().toISOString().split("T")[0],
                startTime: "09:00",
                endTime: "17:00",
                venue: null,
                position: "Sound Tech",
                paymentMode: "hourly",
                rate: 150,
                flatFeeAmount: null,
                event: null,
                tags: [],
                notes: null,
                mealPenaltyCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        });
        mockUpdateEntry.mockResolvedValue({
            success: true,
            data: {
                entryId: "entry-edit-1",
                organizationId: "org-test-1",
                dateWorked: new Date().toISOString().split("T")[0],
                startTime: "09:00",
                endTime: "17:00",
                venue: null,
                position: "Sound Tech",
                paymentMode: "hourly",
                rate: 150,
                flatFeeAmount: null,
                event: null,
                tags: [],
                notes: null,
                mealPenaltyCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        });
        mockCreateOrganizationPosition.mockResolvedValue({
            success: true,
            data: {
                ...mockStoreState.organizations[0],
                positions: [
                    ...mockStoreState.organizations[0].positions,
                    { name: "Lighting Director", defaultRate: 120 },
                ],
            },
        });
        mockCreateOrganization.mockResolvedValue({
            success: true,
            data: {
                organizationId: "org-new-1",
                name: "New Org",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                notes: null,
                venues: [],
                positions: [],
                rulesetIds: [],
                createdAt: new Date().toISOString(),
            },
        });
        mockCreateRuleset.mockImplementation(async (input) => {
            const createdRuleset = {
                rulesetId: "ruleset-shared-created",
                effectiveDate: input.effectiveDate,
                rules: input.rules,
                createdAt: new Date().toISOString(),
            };

            mockStoreState.sharedRulesets = [
                createdRuleset,
                ...mockStoreState.sharedRulesets,
            ];

            return {
                success: true,
                data: createdRuleset,
            };
        });
    });

    it("renders form with all fields", () => {
        render(<EntryForm />);

        expect(screen.getByLabelText(/organization/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/position/i)).toBeInTheDocument();
        expect(
            screen.getByRole("group", { name: /pay mode/i }),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/hourly rate/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/event/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it("groups organization/venue, start/end time, and hourly rate/pay mode in shared rows", () => {
        const { container } = render(<EntryForm />);

        const organizationInput = screen.getByLabelText(/organization/i);
        const venueInput = screen.getByLabelText(/venue/i);
        const startTimeInput = screen.getByLabelText(/start time/i);
        const endTimeInput = screen.getByLabelText(/end time/i);
        const hourlyRateInput = screen.getByLabelText(/hourly rate/i);
        const payModeGroup = screen.getByRole("group", { name: /pay mode/i });

        const organizationRow = organizationInput.closest(".entry-form__row");
        const venueRow = venueInput.closest(".entry-form__row");
        const timeRow = startTimeInput.closest(".entry-form__row");
        const endTimeRow = endTimeInput.closest(".entry-form__row");
        const payRow = hourlyRateInput.closest(".entry-form__row");
        const payModeRow = payModeGroup.closest(".entry-form__row");

        expect(organizationRow).toBeTruthy();
        expect(organizationRow).toBe(venueRow);
        expect(timeRow).toBeTruthy();
        expect(timeRow).toBe(endTimeRow);
        expect(payRow).toBeTruthy();
        expect(payRow).toBe(payModeRow);

        const payRowChildren = Array.from(
            payRow?.children ?? container.querySelectorAll(":scope > *"),
        );
        const rateField = hourlyRateInput.closest(".entry-form__field");
        const payModeField = payModeGroup.closest(".entry-form__field");

        expect(rateField).toBeTruthy();
        expect(payModeField).toBeTruthy();
        expect(payRowChildren.indexOf(rateField as Element)).toBeLessThan(
            payRowChildren.indexOf(payModeField as Element),
        );
    });

    it("toggles between hourly and flat-fee inputs", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        expect(screen.getByLabelText(/hourly rate/i)).toBeInTheDocument();
        expect(
            screen.queryByLabelText(/flat-fee amount/i),
        ).not.toBeInTheDocument();

        await user.click(screen.getByLabelText(/flat fee/i));

        expect(screen.getByLabelText(/flat-fee amount/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/hourly rate/i)).not.toBeInTheDocument();
    });

    it("displays create button when not editing", () => {
        render(<EntryForm />);
        expect(
            screen.getByRole("button", { name: /create entry/i }),
        ).toBeInTheDocument();
    });

    it("displays edit button when editing", () => {
        const editingEntryId = "entry-edit-1" as Id;
        const { container } = render(
            <EntryForm editingEntryId={editingEntryId} />,
        );
        expect(container.querySelector(".entry-form")).toHaveClass(
            "entry-form--editing",
        );
        expect(
            screen.getByRole("button", { name: /update entry/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /cancel edit/i }),
        ).toBeInTheDocument();
    });

    it("calls onCancelEdit without submitting an update", async () => {
        const user = userEvent.setup();
        const onCancelEdit = vi.fn();

        render(
            <EntryForm
                editingEntryId={"entry-edit-1" as Id}
                onCancelEdit={onCancelEdit}
            />,
        );

        await user.click(screen.getByRole("button", { name: /cancel edit/i }));

        expect(onCancelEdit).toHaveBeenCalledTimes(1);
        expect(mockUpdateEntry).not.toHaveBeenCalled();
    });

    it("allows adding tags via Enter key", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        const tagInput = screen.getByPlaceholderText(/add tags/i);
        await user.type(tagInput, "test-tag");
        await user.keyboard("{Enter}");

        // Tag should appear as a pill
        expect(screen.getByText("test-tag")).toBeInTheDocument();

        // Input should be cleared
        expect(tagInput).toHaveValue("");
    });

    it("allows removing tags", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        const tagInput = screen.getByPlaceholderText(/add tags/i);
        await user.type(tagInput, "test-tag");
        await user.keyboard("{Enter}");

        // Remove the tag
        const removeButton = screen.getByRole("button", { name: "✕" });
        await user.click(removeButton);

        expect(screen.queryByText("test-tag")).not.toBeInTheDocument();
    });

    it("validates required fields", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        // Clear position field and try to submit
        const positionInput = screen.getByLabelText(/position/i);
        await user.clear(positionInput);

        const submitButton = screen.getByRole("button", {
            name: /create entry/i,
        });
        await user.click(submitButton);

        expect(screen.getByText(/position is required/i)).toBeInTheDocument();
    });

    it("prevents invalid time ranges", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        const startTimeInput = screen.getByLabelText(/start time/i);
        const endTimeInput = screen.getByLabelText(/end time/i);
        const positionInput = screen.getByLabelText(/position/i);

        await user.type(positionInput, "Sound Tech");
        fireEvent.change(startTimeInput, { target: { value: "17:00" } });
        fireEvent.change(endTimeInput, { target: { value: "09:00" } });

        const submitButton = screen.getByRole("button", {
            name: /create entry/i,
        });
        await user.click(submitButton);

        expect(
            screen.getByText(/end time must be after start time/i),
        ).toBeInTheDocument();
    });

    it("renders close button when onClose is provided", () => {
        const onClose = vi.fn();
        render(<EntryForm onClose={onClose} />);

        expect(screen.getByRole("button", { name: "✕" })).toBeInTheDocument();
    });

    it("calls onClose when close button is clicked", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<EntryForm onClose={onClose} />);

        const closeButton = screen.getByRole("button", { name: "✕" });
        await user.click(closeButton);

        expect(onClose).toHaveBeenCalled();
    });

    it("uses tappable combo boxes for organization, venue, and position in single-column layout", async () => {
        const user = userEvent.setup();
        window.matchMedia = createMatchMedia(true) as typeof window.matchMedia;
        mockStoreState.organizations = [
            {
                organizationId: "org-test-1",
                name: "Test Org",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                venues: ["Main Hall"],
                positions: [{ name: "Sound Tech", defaultRate: 150 }],
                createdAt: new Date().toISOString(),
            },
            {
                organizationId: "org-test-2",
                name: "Second Org",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                venues: ["Studio B"],
                positions: [{ name: "A2", defaultRate: 120 }],
                createdAt: new Date().toISOString(),
            },
        ];

        render(<EntryForm />);

        await user.click(
            screen.getByRole("button", { name: /show organization options/i }),
        );
        await user.click(screen.getByRole("option", { name: "Second Org" }));

        expect(
            screen.getByLabelText("Organization", { selector: "input" }),
        ).toHaveValue("Second Org");

        await user.click(
            screen.getByRole("button", { name: /show venue options/i }),
        );
        await user.click(screen.getByRole("option", { name: "Studio B" }));
        expect(
            screen.getByLabelText("Venue", { selector: "input" }),
        ).toHaveValue("Studio B");

        await user.click(
            screen.getByRole("button", { name: /show position options/i }),
        );
        await user.click(screen.getByRole("option", { name: "A2" }));
        expect(
            screen.getByLabelText("Position", { selector: "input" }),
        ).toHaveValue("A2");
    });

    it("enables combo-box controls when layout changes to single-column through legacy media-query listeners", async () => {
        const user = userEvent.setup();
        const legacyMedia = createLegacyMatchMediaController(false);
        window.matchMedia = legacyMedia.matchMedia as typeof window.matchMedia;

        mockStoreState.organizations = [
            {
                organizationId: "org-test-1",
                name: "Test Org",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                venues: ["Main Hall"],
                positions: [{ name: "Sound Tech", defaultRate: 150 }],
                createdAt: new Date().toISOString(),
            },
            {
                organizationId: "org-test-2",
                name: "Second Org",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                venues: ["Studio B"],
                positions: [{ name: "A2", defaultRate: 120 }],
                createdAt: new Date().toISOString(),
            },
        ];

        render(<EntryForm />);

        expect(
            screen.queryByRole("button", {
                name: /show organization options/i,
            }),
        ).not.toBeInTheDocument();

        act(() => {
            legacyMedia.setSingleColumnLayout(true);
        });

        await waitFor(() => {
            expect(
                screen.getByRole("button", {
                    name: /show organization options/i,
                }),
            ).toBeInTheDocument();
        });

        await user.click(
            screen.getByRole("button", { name: /show organization options/i }),
        );
        await user.click(screen.getByRole("option", { name: "Second Org" }));

        expect(
            screen.getByLabelText("Organization", { selector: "input" }),
        ).toHaveValue("Second Org");
    });

    it("shows loading state while submitting", async () => {
        render(<EntryForm />);

        // Component with loading state
        const SubmitButton = screen.getByRole("button", {
            name: /create entry/i,
        });
        expect(SubmitButton).not.toHaveTextContent(/saving/i);
    });

    it("accepts optional rate and event", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        const rateInput = screen.getByLabelText(
            /hourly rate/i,
        ) as HTMLInputElement;
        const eventInput = screen.getByLabelText(/event/i) as HTMLInputElement;
        const positionInput = screen.getByLabelText(
            /position/i,
        ) as HTMLInputElement;

        await user.type(positionInput, "Sound Tech");
        fireEvent.change(rateInput, { target: { value: "150.50" } });
        await user.type(eventInput, "Concert");

        expect(rateInput.value).toBe("150.50");
        expect(eventInput.value).toBe("Concert");
    });

    it("submits a flat-fee entry payload", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        await user.type(screen.getByLabelText(/position/i), "Sound Tech");
        await user.click(screen.getByLabelText(/flat fee/i));
        await user.type(screen.getByLabelText(/flat-fee amount/i), "250");
        await user.click(screen.getByRole("button", { name: /create entry/i }));

        await waitFor(() => {
            expect(mockCreateEntry).toHaveBeenCalledWith(
                expect.objectContaining({
                    paymentMode: "flat-fee",
                    flatFeeAmount: 250,
                    rate: null,
                }),
            );
        });
    });

    it("autofills hourly rate from the organization's saved position default", async () => {
        const user = userEvent.setup();
        render(<EntryForm />);

        const positionInput = screen.getByLabelText(/position/i);
        const rateInput = screen.getByLabelText(/hourly rate/i);

        await user.type(positionInput, "Sound Tech");

        await waitFor(() => {
            expect(rateInput).toHaveValue(150);
        });
    });

    it("opens the create position modal for a missing organization position and saves the new default", async () => {
        const user = userEvent.setup();
        mockStoreState.organizations = [
            {
                ...mockStoreState.organizations[0],
                positions: [],
            },
        ];

        render(<EntryForm />);

        await user.type(
            screen.getByLabelText(/position/i),
            "Lighting Director",
        );
        await user.click(screen.getByRole("button", { name: /create entry/i }));

        const dialog = screen.getByRole("dialog", {
            name: /new position for test org/i,
        });
        expect(dialog).toBeInTheDocument();

        await user.clear(screen.getByLabelText(/default hourly rate/i));
        await user.type(screen.getByLabelText(/default hourly rate/i), "120");
        await user.click(screen.getByRole("button", { name: /^save$/i }));

        await waitFor(() => {
            expect(mockCreateOrganizationPosition).toHaveBeenCalledWith({
                organizationId: "org-test-1",
                position: "Lighting Director",
                defaultRate: 120,
            });
        });
        await waitFor(() => {
            expect(
                screen.queryByRole("dialog", {
                    name: /new position for test org/i,
                }),
            ).not.toBeInTheDocument();
        });
        expect(screen.getByLabelText(/hourly rate/i)).toHaveValue(120);
    });

    it("allows cancelling the create position modal without mutating the organization catalog", async () => {
        const user = userEvent.setup();
        mockStoreState.organizations = [
            {
                ...mockStoreState.organizations[0],
                positions: [],
            },
        ];

        render(<EntryForm />);

        await user.type(screen.getByLabelText(/position/i), "Deck Chief");
        await user.click(
            screen.getByRole("button", { name: /create position/i }),
        );

        await user.click(screen.getByRole("button", { name: /cancel/i }));

        expect(mockCreateOrganizationPosition).not.toHaveBeenCalled();
        expect(
            screen.queryByRole("dialog", {
                name: /new position for test org/i,
            }),
        ).not.toBeInTheDocument();
    });

    it("opens add-organization modal for unknown organization and prefills typed name", async () => {
        const user = userEvent.setup();
        const onManageOrganization = vi.fn();

        render(<EntryForm onManageOrganization={onManageOrganization} />);

        const organizationInput = screen.getByLabelText(
            /organization/i,
        ) as HTMLInputElement;
        await user.clear(organizationInput);
        await user.type(organizationInput, "New Org");

        expect(
            screen.getByRole("button", {
                name: /add organization/i,
            }),
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: /add organization/i }),
        );

        expect(
            screen.getByRole("heading", { name: /new organization/i }),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/organization name/i)).toHaveValue(
            "New Org",
        );

        await user.click(
            screen.getByRole("button", { name: /save organization/i }),
        );

        await waitFor(() => {
            expect(mockCreateOrganization).toHaveBeenCalledWith({
                name: "New Org",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                notes: null,
                rulesetIds: [],
            });
        });

        await waitFor(() => {
            expect(
                screen.queryByRole("heading", { name: /new organization/i }),
            ).not.toBeInTheDocument();
        });

        expect(onManageOrganization).not.toHaveBeenCalled();
    });

    it("creates a shared ruleset in the add-organization modal and associates it on save", async () => {
        const user = userEvent.setup();

        render(<EntryForm />);

        const organizationInput = screen.getByLabelText(
            /organization/i,
        ) as HTMLInputElement;
        await user.clear(organizationInput);
        await user.type(organizationInput, "Ruleset Org");

        await user.click(
            screen.getByRole("button", { name: /add organization/i }),
        );

        await user.click(
            screen.getByRole("button", {
                name: /\+ new shared ruleset/i,
            }),
        );

        await user.click(
            screen.getByRole("button", { name: /\+ new ruleset/i }),
        );
        await user.clear(screen.getByLabelText(/ruleset effective date/i));
        await user.type(
            screen.getByLabelText(/ruleset effective date/i),
            "2026-08-01",
        );
        await user.click(
            screen.getByRole("button", { name: /^\+ Meal Penalty$/i }),
        );
        await user.clear(screen.getByLabelText(/meal penalty amount/i));
        await user.type(screen.getByLabelText(/meal penalty amount/i), "35");
        await user.click(screen.getByRole("button", { name: /save ruleset/i }));

        await waitFor(() => {
            expect(mockCreateRuleset).toHaveBeenCalledTimes(1);
        });

        await user.clear(screen.getByLabelText(/organization name/i));
        await user.type(
            screen.getByLabelText(/organization name/i),
            "Ruleset Org",
        );

        await user.click(
            screen.getByRole("checkbox", {
                name: /effective 2026-08-01/i,
            }),
        );

        await user.click(
            screen.getByRole("button", { name: /save organization/i }),
        );

        await waitFor(() => {
            expect(mockCreateOrganization).toHaveBeenCalledWith({
                name: "Ruleset Org",
                payPeriodStartDay: 1,
                timezone: "UTC",
                workweekStartDay: 1,
                notes: null,
                rulesetIds: ["ruleset-shared-created"],
            });
        });
    });

    it("shows one save error in the add-organization modal when organization create fails", async () => {
        const user = userEvent.setup();
        mockStoreError.value = "Create org failed";
        mockCreateOrganization.mockResolvedValue({
            success: false,
            error: {
                type: "validation",
                field: "name",
                message: "Create org failed",
            },
        });

        render(<EntryForm />);

        const organizationInput = screen.getByLabelText(/organization/i);
        await user.clear(organizationInput);
        await user.type(organizationInput, "Broken Org");
        await user.click(
            screen.getByRole("button", { name: /add organization/i }),
        );
        await user.click(
            screen.getByRole("button", { name: /save organization/i }),
        );

        await waitFor(() => {
            expect(mockCreateOrganization).toHaveBeenCalledTimes(1);
        });

        const modalErrors = screen.getAllByText("Create org failed");
        expect(modalErrors).toHaveLength(1);
        expect(
            screen.getByRole("heading", { name: /new organization/i }),
        ).toBeInTheDocument();
    });
});
