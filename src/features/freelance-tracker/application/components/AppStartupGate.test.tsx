import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppStartupGate } from "./AppStartupGate";

describe("AppStartupGate", () => {
    it("renders children immediately in json mode", () => {
        render(
            <AppStartupGate firebaseMode={false}>
                <div>Tracker</div>
            </AppStartupGate>,
        );

        expect(screen.getByText("Tracker")).toBeInTheDocument();
        expect(screen.queryByText("Syncing")).not.toBeInTheDocument();
    });

    it("shows syncing while firebase bootstrap is pending", async () => {
        const bootstrapAuth = vi.fn(
            () => new Promise((resolve) => setTimeout(resolve, 20)),
        );

        render(
            <AppStartupGate firebaseMode bootstrapAuth={bootstrapAuth}>
                <div>Tracker</div>
            </AppStartupGate>,
        );

        expect(screen.getByText("Syncing")).toBeInTheDocument();
        expect(await screen.findByText("Tracker")).toBeInTheDocument();
    });

    it("shows bootstrap error and retries successfully", async () => {
        const bootstrapAuth = vi
            .fn()
            .mockRejectedValueOnce(new Error("Missing Firebase config"))
            .mockResolvedValueOnce(undefined);

        const user = userEvent.setup();

        render(
            <AppStartupGate firebaseMode bootstrapAuth={bootstrapAuth}>
                <div>Tracker</div>
            </AppStartupGate>,
        );

        expect(await screen.findByText("Bootstrap Error")).toBeInTheDocument();
        expect(
            screen.getByText(/missing firebase config/i),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /retry/i }));

        expect(await screen.findByText("Tracker")).toBeInTheDocument();
        expect(bootstrapAuth).toHaveBeenCalledTimes(2);
    });
});
