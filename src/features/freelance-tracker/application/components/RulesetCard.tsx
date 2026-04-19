import type { Ruleset } from "@/features/freelance-tracker/contracts/types";
import { formatDate } from "./RulesetEditor.utils";

export const ruleTypeLabel: Record<string, string> = {
    "daily-overtime": "Daily OT",
    "weekly-overtime": "Weekly OT",
    "meal-penalty": "Meal Penalty",
    "holiday-rate": "Holiday Rate",
    "time-window-multiplier": "Time Window",
    custom: "Custom",
};

type RulesetCardProps = {
    ruleset: Ruleset;
    isActive: boolean;
};

export const RulesetCard: React.FC<RulesetCardProps> = ({
    ruleset,
    isActive,
}) => (
    <div
        className={`ruleset-editor__card${isActive ? " ruleset-editor__card--active" : ""}`}
    >
        <div className="ruleset-editor__card-header">
            <span className="ruleset-editor__card-date">
                Effective {formatDate(ruleset.effectiveDate)}
            </span>
            {isActive && (
                <span className="ruleset-editor__card-badge">Active</span>
            )}
        </div>
        {ruleset.rules.length === 0 ? (
            <span className="ruleset-editor__card-empty">No rules</span>
        ) : (
            <ul className="ruleset-editor__card-rules">
                {ruleset.rules.map((r) => (
                    <li key={r.ruleId} className="ruleset-editor__card-rule">
                        <span className="ruleset-editor__rule-type-badge ruleset-editor__rule-type-badge--sm">
                            {ruleTypeLabel[r.type] ?? r.type}
                        </span>
                        {r.description && (
                            <span className="ruleset-editor__card-rule-desc">
                                {r.description}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        )}
    </div>
);
