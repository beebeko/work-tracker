import {
    useCallback,
    useEffect,
    useState,
    type PropsWithChildren,
} from "react";

import { isFirebaseAdapterEnabled } from "@/features/freelance-tracker/data";
import { bootstrapAnonymousAuth } from "@/features/freelance-tracker/integration/firebase";
import {
    maybeRunBootstrapOverride,
    resolveFirebaseModeForE2E,
} from "../e2eStartupOverrides";

import "./AppStartupGate.css";

type StartupPhase = "ready" | "bootstrapping" | "error";

type AppStartupGateProps = PropsWithChildren<{
    firebaseMode?: boolean;
    bootstrapAuth?: () => Promise<unknown>;
}>;

export function AppStartupGate({
    children,
    firebaseMode = resolveFirebaseModeForE2E(isFirebaseAdapterEnabled()),
    bootstrapAuth = bootstrapAnonymousAuth,
}: AppStartupGateProps) {
    const [phase, setPhase] = useState<StartupPhase>(
        firebaseMode ? "bootstrapping" : "ready",
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const runBootstrap = useCallback(async () => {
        if (!firebaseMode) {
            setPhase("ready");
            setErrorMessage(null);
            return;
        }

        setPhase("bootstrapping");
        setErrorMessage(null);

        try {
            const overrideHandled = await maybeRunBootstrapOverride();
            if (!overrideHandled) {
                await bootstrapAuth();
            }
            setPhase("ready");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Startup bootstrap failed";
            setErrorMessage(message);
            setPhase("error");
        }
    }, [bootstrapAuth, firebaseMode]);

    useEffect(() => {
        void runBootstrap();
    }, [runBootstrap]);

    if (phase === "ready") {
        return <>{children}</>;
    }

    if (phase === "error") {
        return (
            <div className="app-startup-gate" role="alert">
                <p className="app-startup-gate__status">Bootstrap Error</p>
                <p className="app-startup-gate__message">{errorMessage}</p>
                <button
                    type="button"
                    className="app-startup-gate__retry"
                    onClick={() => {
                        void runBootstrap();
                    }}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="app-startup-gate" role="status" aria-live="polite">
            <p className="app-startup-gate__status">Syncing</p>
            <p className="app-startup-gate__message">
                Preparing secure local sync...
            </p>
        </div>
    );
}
