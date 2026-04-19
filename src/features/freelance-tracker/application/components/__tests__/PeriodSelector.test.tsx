import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PeriodSelector, type PeriodValue } from "../PeriodSelector";

const getExpectedThisMonth = (): PeriodValue => {
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

describe("PeriodSelector", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-04-14T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("defaults to This Month on mount", () => {
        const onChange = vi.fn();

        render(
            <PeriodSelector
                label="History Period"
                value={null}
                onChange={onChange}
                defaultPreset="this-month"
            />,
        );

        const group = screen.getByRole("group", { name: /history period/i });

        expect(
            within(group).getByRole("button", { name: /this month/i }),
        ).toHaveClass("period-selector__button--active");
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(getExpectedThisMonth());
    });

    it("does not apply an invalid custom range", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <PeriodSelector
                label="Summary Period"
                value={getExpectedThisMonth()}
                onChange={onChange}
            />,
        );

        onChange.mockClear();
        await user.click(screen.getByRole("button", { name: /custom/i }));

        fireEvent.change(screen.getByLabelText(/start/i), {
            target: { value: "2026-04-20" },
        });
        fireEvent.change(screen.getByLabelText(/end/i), {
            target: { value: "2026-04-10" },
        });

        const applyButton = screen.getByRole("button", { name: /apply/i });
        expect(applyButton).toBeDisabled();
        expect(onChange).not.toHaveBeenCalled();
    });
});
