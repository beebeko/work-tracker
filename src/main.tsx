import React from "react";
import { createRoot } from "react-dom/client";
import {
    AppStartupGate,
    FreelanceTrackerApp,
} from "@/features/freelance-tracker";

const rootElement = document.getElementById("root");

if (!rootElement) {
    throw new Error("Root element '#root' not found");
}

createRoot(rootElement).render(
    <React.StrictMode>
        <AppStartupGate>
            <FreelanceTrackerApp />
        </AppStartupGate>
    </React.StrictMode>,
);
