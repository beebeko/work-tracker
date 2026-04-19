import type {
    NonOTForm,
    MealPenaltyForm,
    HolidayRateForm,
    TimeWindowForm,
    CustomRuleForm,
} from "./RulesetEditor.types";

type NonOTRuleRowProps = {
    form: NonOTForm;
    onChange: (updated: NonOTForm) => void;
    onRemove: () => void;
};

const typeLabel: Record<NonOTForm["type"], string> = {
    "meal-penalty": "Meal Penalty",
    "holiday-rate": "Holiday Rate",
    "time-window-multiplier": "Time Window",
    custom: "Custom",
};

export const NonOTRuleRow: React.FC<NonOTRuleRowProps> = ({
    form,
    onChange,
    onRemove,
}) => (
    <div className="ruleset-editor__rule-row">
        <div className="ruleset-editor__rule-row-header">
            <span className="ruleset-editor__rule-type-badge">
                {typeLabel[form.type]}
            </span>
            <button
                type="button"
                className="ruleset-editor__rule-remove"
                aria-label="Remove rule"
                onClick={onRemove}
            >
                ✕
            </button>
        </div>
        <div className="ruleset-editor__rule-fields">
            <div className="ruleset-editor__field">
                <label>Description (label)</label>
                <input
                    type="text"
                    value={form.description}
                    placeholder="Label shown in pay summary"
                    onChange={(e) =>
                        onChange({ ...form, description: e.target.value })
                    }
                />
            </div>

            {form.type === "meal-penalty" && (
                <div className="ruleset-editor__field">
                    <label>Penalty amount ($)</label>
                    <input
                        type="number"
                        aria-label="Meal penalty amount"
                        min="0"
                        step="0.01"
                        value={form.penaltyAmount}
                        onChange={(e) =>
                            onChange({
                                ...form,
                                penaltyAmount: e.target.value,
                            } as MealPenaltyForm)
                        }
                    />
                </div>
            )}

            {form.type === "holiday-rate" && (
                <>
                    <div className="ruleset-editor__field">
                        <label>Holiday dates</label>
                        <div className="ruleset-editor__holiday-input-row">
                            <input
                                type="date"
                                aria-label="Holiday date"
                                value={form.holidayDateInput}
                                onChange={(e) =>
                                    onChange({
                                        ...form,
                                        holidayDateInput: e.target.value,
                                    } as HolidayRateForm)
                                }
                            />
                            <button
                                type="button"
                                className="ruleset-editor__add-rule"
                                onClick={() => {
                                    if (!form.holidayDateInput) return;
                                    if (
                                        form.holidayDates.includes(
                                            form.holidayDateInput,
                                        )
                                    ) {
                                        onChange({
                                            ...form,
                                            holidayDateInput: "",
                                        } as HolidayRateForm);
                                        return;
                                    }
                                    onChange({
                                        ...form,
                                        holidayDates: [
                                            ...form.holidayDates,
                                            form.holidayDateInput,
                                        ].sort(),
                                        holidayDateInput: "",
                                    } as HolidayRateForm);
                                }}
                            >
                                Add date
                            </button>
                        </div>
                        {form.holidayDates.length > 0 && (
                            <ul className="ruleset-editor__chip-list">
                                {form.holidayDates.map((date) => (
                                    <li
                                        key={date}
                                        className="ruleset-editor__chip"
                                    >
                                        <span>{date}</span>
                                        <button
                                            type="button"
                                            className="ruleset-editor__chip-remove"
                                            aria-label={`Remove holiday date ${date}`}
                                            onClick={() =>
                                                onChange({
                                                    ...form,
                                                    holidayDates:
                                                        form.holidayDates.filter(
                                                            (candidate) =>
                                                                candidate !==
                                                                date,
                                                        ),
                                                } as HolidayRateForm)
                                            }
                                        >
                                            x
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="ruleset-editor__field">
                        <label>Multiplier</label>
                        <input
                            type="number"
                            aria-label="Holiday rate multiplier"
                            min="1"
                            step="0.05"
                            value={form.multiplier}
                            onChange={(e) =>
                                onChange({
                                    ...form,
                                    multiplier: e.target.value,
                                } as HolidayRateForm)
                            }
                        />
                    </div>
                </>
            )}

            {form.type === "time-window-multiplier" && (
                <>
                    <div className="ruleset-editor__field">
                        <label>Window start</label>
                        <input
                            type="time"
                            aria-label="Time window start"
                            value={form.windowStart}
                            onChange={(e) =>
                                onChange({
                                    ...form,
                                    windowStart: e.target.value,
                                } as TimeWindowForm)
                            }
                        />
                    </div>
                    <div className="ruleset-editor__field">
                        <label>Window end</label>
                        <input
                            type="time"
                            aria-label="Time window end"
                            value={form.windowEnd}
                            onChange={(e) =>
                                onChange({
                                    ...form,
                                    windowEnd: e.target.value,
                                } as TimeWindowForm)
                            }
                        />
                    </div>
                    <div className="ruleset-editor__field">
                        <label>Multiplier</label>
                        <input
                            type="number"
                            aria-label="Time window multiplier"
                            min="1"
                            step="0.05"
                            value={form.multiplier}
                            onChange={(e) =>
                                onChange({
                                    ...form,
                                    multiplier: e.target.value,
                                } as TimeWindowForm)
                            }
                        />
                    </div>
                </>
            )}

            {form.type === "custom" && (
                <>
                    <div className="ruleset-editor__field">
                        <label>Scope</label>
                        <select
                            aria-label="Custom rule scope"
                            value={form.scope}
                            onChange={(e) =>
                                onChange({
                                    ...form,
                                    scope: e.target
                                        .value as CustomRuleForm["scope"],
                                } as CustomRuleForm)
                            }
                        >
                            <option value="position">Position</option>
                            <option value="tag">Tag</option>
                            <option value="date-range">Date Range</option>
                            <option value="event">Event</option>
                        </select>
                    </div>

                    {form.scope === "date-range" ? (
                        <div className="ruleset-editor__field-grid">
                            <div className="ruleset-editor__field">
                                <label>Start date</label>
                                <input
                                    type="date"
                                    aria-label="Custom rule start date"
                                    value={form.startDate}
                                    onChange={(e) =>
                                        onChange({
                                            ...form,
                                            startDate: e.target.value,
                                        } as CustomRuleForm)
                                    }
                                />
                            </div>
                            <div className="ruleset-editor__field">
                                <label>End date</label>
                                <input
                                    type="date"
                                    aria-label="Custom rule end date"
                                    value={form.endDate}
                                    onChange={(e) =>
                                        onChange({
                                            ...form,
                                            endDate: e.target.value,
                                        } as CustomRuleForm)
                                    }
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="ruleset-editor__field">
                            <label>Matches value</label>
                            <input
                                type="text"
                                aria-label="Custom rule matches value"
                                value={form.matchesInput}
                                placeholder="e.g., Lead or rush (comma-separated supported)"
                                onChange={(e) =>
                                    onChange({
                                        ...form,
                                        matchesInput: e.target.value,
                                    } as CustomRuleForm)
                                }
                            />
                        </div>
                    )}

                    <div className="ruleset-editor__field-grid">
                        <div className="ruleset-editor__field">
                            <label>Payout type</label>
                            <select
                                aria-label="Custom rule payout type"
                                value={form.payoutMode}
                                onChange={(e) =>
                                    onChange({
                                        ...form,
                                        payoutMode: e.target
                                            .value as CustomRuleForm["payoutMode"],
                                    } as CustomRuleForm)
                                }
                            >
                                <option value="multiplier">Multiplier</option>
                                <option value="advanced">
                                    Advanced JSON fallback
                                </option>
                            </select>
                        </div>

                        {form.payoutMode === "multiplier" && (
                            <div className="ruleset-editor__field">
                                <label>Multiplier value</label>
                                <input
                                    type="number"
                                    aria-label="Custom rule multiplier value"
                                    min="0.01"
                                    step="0.05"
                                    value={form.multiplierValue}
                                    onChange={(e) =>
                                        onChange({
                                            ...form,
                                            multiplierValue: e.target.value,
                                        } as CustomRuleForm)
                                    }
                                />
                            </div>
                        )}
                    </div>

                    <details className="ruleset-editor__advanced">
                        <summary>Advanced custom JSON fallback</summary>
                        <p className="ruleset-editor__advanced-hint">
                            Use this only for DSL fields not covered by typed
                            controls.
                        </p>
                        <div className="ruleset-editor__field">
                            <label>Condition (JSON)</label>
                            <textarea
                                aria-label="Custom rule condition JSON"
                                rows={3}
                                value={form.conditionJson}
                                onChange={(e) =>
                                    onChange({
                                        ...form,
                                        conditionJson: e.target.value,
                                    } as CustomRuleForm)
                                }
                            />
                        </div>
                        <div className="ruleset-editor__field">
                            <label>Payout (JSON)</label>
                            <textarea
                                aria-label="Custom rule payout JSON"
                                rows={3}
                                value={form.payoutJson}
                                onChange={(e) =>
                                    onChange({
                                        ...form,
                                        payoutJson: e.target.value,
                                    } as CustomRuleForm)
                                }
                            />
                        </div>
                    </details>
                </>
            )}
        </div>
    </div>
);
