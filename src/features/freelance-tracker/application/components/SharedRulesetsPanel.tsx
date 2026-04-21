import { useMemo } from "react";
import { useFreelanceTracker } from "../hooks";
import { RulesetEditor } from "./RulesetEditor";
import "./SharedRulesetsPanel.css";

export const SharedRulesetsPanel: React.FC = () => {
    const store = useFreelanceTracker();
    const assignmentSummary = store.getSharedRulesetAssignmentSummary();

    const counts = useMemo(() => {
        const assigned = assignmentSummary.filter(
            (summary) => summary.isAssigned,
        ).length;
        const unassigned = assignmentSummary.length - assigned;

        return {
            total: assignmentSummary.length,
            assigned,
            unassigned,
        };
    }, [assignmentSummary]);

    return (
        <section className="shared-rulesets-panel" aria-label="Shared rulesets">
            <header className="shared-rulesets-panel__header">
                <h2 className="shared-rulesets-panel__title">
                    Shared Rulesets
                </h2>
                <p className="shared-rulesets-panel__subtitle">
                    Manage reusable pay rulesets across organizations.
                </p>
                <div className="shared-rulesets-panel__stats" role="list">
                    <span
                        className="shared-rulesets-panel__stat"
                        role="listitem"
                    >
                        Total: {counts.total}
                    </span>
                    <span
                        className="shared-rulesets-panel__stat shared-rulesets-panel__stat--assigned"
                        role="listitem"
                    >
                        Assigned: {counts.assigned}
                    </span>
                    <span
                        className="shared-rulesets-panel__stat shared-rulesets-panel__stat--unassigned"
                        role="listitem"
                    >
                        Unassigned: {counts.unassigned}
                    </span>
                </div>
            </header>

            <RulesetEditor scope="shared" showAssignmentSummary />
        </section>
    );
};
