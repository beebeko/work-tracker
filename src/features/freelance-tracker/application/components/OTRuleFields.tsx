import type { DailyOTForm, WeeklyOTForm } from "./RulesetEditor.types";

type OTRuleFieldsProps = {
    form: DailyOTForm | WeeklyOTForm;
    onChange: (updated: DailyOTForm | WeeklyOTForm) => void;
};

export const OTRuleFields: React.FC<OTRuleFieldsProps> = ({
    form,
    onChange,
}) => (
    <div className="ruleset-editor__rule-fields">
        <div className="ruleset-editor__field">
            <label>Description (label)</label>
            <input
                type="text"
                value={form.description}
                placeholder="e.g., Daily OT (1.5×)"
                onChange={(e) =>
                    onChange({ ...form, description: e.target.value })
                }
            />
        </div>
        {form.type === "daily-overtime" ? (
            <div className="ruleset-editor__field">
                <label>Daily threshold (hours)</label>
                <input
                    type="number"
                    aria-label="Daily threshold hours"
                    min="0"
                    step="0.5"
                    value={form.dailyThresholdHours}
                    onChange={(e) =>
                        onChange({
                            ...form,
                            dailyThresholdHours: e.target.value,
                        } as DailyOTForm)
                    }
                />
            </div>
        ) : (
            <div className="ruleset-editor__field">
                <label>Weekly threshold (hours)</label>
                <input
                    type="number"
                    aria-label="Weekly threshold hours"
                    min="0"
                    step="0.5"
                    value={form.weeklyThresholdHours}
                    onChange={(e) =>
                        onChange({
                            ...form,
                            weeklyThresholdHours: e.target.value,
                        } as WeeklyOTForm)
                    }
                />
            </div>
        )}
        <div className="ruleset-editor__field">
            <label>Multiplier</label>
            <input
                type="number"
                aria-label="Overtime multiplier"
                min="1"
                step="0.05"
                value={form.multiplier}
                onChange={(e) =>
                    onChange({ ...form, multiplier: e.target.value })
                }
            />
        </div>
    </div>
);
