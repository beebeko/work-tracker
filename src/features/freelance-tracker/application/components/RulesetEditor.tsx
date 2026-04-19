/**
 * RulesetEditor - View and author pay rulesets for an organization.
 *
 * Design decisions:
 *   - OT type is a segmented control (None/Daily/Weekly); switching removes the prior OT rule
 *     automatically per domain policy (only one OT rule per ruleset).
 *   - Non-OT rules are a flat list; warning banner fires when TimeWindow rules have overlapping
 *     coverage or HolidayRate rules share any date.
 *   - Custom rule JSON remains available only in an explicit advanced section.
 */

import { useState, useEffect } from "react";
import { useFreelanceTracker } from "../hooks";
import type {
    Rule,
    Id,
    Ruleset,
} from "@/features/freelance-tracker/contracts/types";
import type {
    OTMode,
    DailyOTForm,
    WeeklyOTForm,
    NonOTForm,
} from "./RulesetEditor.types";
import {
    dalMsg,
    otFormToRule,
    nonOTFormToRule,
    customFormToRule,
    detectOverlaps,
    blankDailyOT,
    blankWeeklyOT,
    blankNonOT,
    toOTMode,
    toNonOTForms,
} from "./RulesetEditor.utils";
import { OTRuleFields } from "./OTRuleFields";
import { NonOTRuleRow } from "./NonOTRuleRow";
import { RulesetCard } from "./RulesetCard";
import "./RulesetEditor.css";

// ── main component ──────────────────────────────────────────────────────────

export type RulesetEditorProps = {
    organizationId: Id;
};

export const RulesetEditor: React.FC<RulesetEditorProps> = ({
    organizationId,
}) => {
    const store = useFreelanceTracker();

    const [view, setView] = useState<"list" | "create" | "edit">("list");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [editingRulesetId, setEditingRulesetId] = useState<Id | null>(null);

    // New-ruleset form state
    const [effectiveDate, setEffectiveDate] = useState(
        () => new Date().toISOString().split("T")[0],
    );
    const [otMode, setOTMode] = useState<OTMode>("none");
    const [otRule, setOTRule] = useState<DailyOTForm | WeeklyOTForm | null>(
        null,
    );
    const [nonOTRules, setNonOTRules] = useState<NonOTForm[]>([]);

    // Load rulesets for this org
    useEffect(() => {
        void store.loadRulesets(organizationId);
    }, [organizationId, store.loadRulesets]);

    const rulesets = store.rulesets.filter(
        (rs) => rs.organizationId === organizationId,
    );
    const activeRuleset = rulesets[0] ?? null; // newest-first per DAL contract

    const resetForm = () => {
        setEffectiveDate(new Date().toISOString().split("T")[0]);
        setOTMode("none");
        setOTRule(null);
        setNonOTRules([]);
        setEditingRulesetId(null);
        setSaveError(null);
    };

    const beginCreate = () => {
        resetForm();
        setView("create");
    };

    const beginEdit = (ruleset: Ruleset) => {
        const { mode, form } = toOTMode(ruleset.rules);
        setEffectiveDate(ruleset.effectiveDate);
        setOTMode(mode);
        setOTRule(form);
        setNonOTRules(toNonOTForms(ruleset.rules));
        setEditingRulesetId(ruleset.rulesetId);
        setSaveError(null);
        setView("edit");
    };

    // ── OT mode changes ───────────────────────────────────────────────────

    const handleOTModeChange = (mode: OTMode) => {
        setOTMode(mode);
        if (mode === "none") {
            setOTRule(null);
        } else if (mode === "daily") {
            setOTRule((prev) => {
                if (prev?.type === "daily-overtime") return prev;
                return {
                    ...blankDailyOT(),
                    description: prev?.description ?? "",
                    multiplier: prev?.multiplier ?? "1.5",
                };
            });
        } else {
            setOTRule((prev) => {
                if (prev?.type === "weekly-overtime") return prev;
                return {
                    ...blankWeeklyOT(),
                    description: prev?.description ?? "",
                    multiplier: prev?.multiplier ?? "1.5",
                };
            });
        }
    };

    // ── non-OT rule mutations ─────────────────────────────────────────────

    const addNonOTRule = (type: NonOTForm["type"]) => {
        setNonOTRules((prev) => [...prev, blankNonOT(type)]);
    };

    const updateNonOTRule = (index: number, updated: NonOTForm) => {
        setNonOTRules((prev) =>
            prev.map((r, i) => (i === index ? updated : r)),
        );
    };

    const removeNonOTRule = (index: number) => {
        setNonOTRules((prev) => prev.filter((_, i) => i !== index));
    };

    // ── overlap warning ───────────────────────────────────────────────────

    const overlapWarning = detectOverlaps(nonOTRules);

    // ── form validation and submission ────────────────────────────────────

    const validateAndCollectRules = (): Rule[] | null => {
        const rules: Rule[] = [];

        if (otRule) {
            const rule = otFormToRule(otRule);
            if (!rule) {
                setSaveError("OT rule has invalid or missing numeric fields.");
                return null;
            }
            rules.push(rule);
        }

        for (const form of nonOTRules) {
            if (form.type === "custom") {
                const customResult = customFormToRule(form);
                if (!customResult.rule) {
                    setSaveError(
                        customResult.error ??
                            `Rule "${form.description || form.type}" has invalid or missing fields.`,
                    );
                    return null;
                }
                rules.push(customResult.rule);
                continue;
            }

            const rule = nonOTFormToRule(form);
            if (!rule) {
                setSaveError(
                    `Rule "${form.description || form.type}" has invalid or missing fields.`,
                );
                return null;
            }
            rules.push(rule);
        }

        if (rules.length === 0) {
            setSaveError("Add at least one rule before saving.");
            return null;
        }

        return rules;
    };

    const handleSave = async () => {
        setSaveError(null);
        if (!effectiveDate) {
            setSaveError("Effective date is required.");
            return;
        }

        const rules = validateAndCollectRules();
        if (!rules) return;

        setSaving(true);
        try {
            if (view === "edit" && editingRulesetId) {
                const deleteResult =
                    await store.deleteRuleset(editingRulesetId);
                if (!deleteResult.success) {
                    setSaveError(
                        dalMsg(deleteResult.error, "Failed to update ruleset."),
                    );
                    return;
                }
            }

            const result = await store.createRuleset({
                organizationId,
                effectiveDate,
                rules,
            });

            if (result.success) {
                await store.loadRulesets(organizationId);
                setView("list");
                resetForm();
            } else {
                setSaveError(dalMsg(result.error, "Failed to save ruleset."));
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editingRulesetId) {
            return;
        }

        setSaveError(null);
        setSaving(true);
        try {
            const result = await store.deleteRuleset(editingRulesetId);
            if (result.success) {
                await store.loadRulesets(organizationId);
                setView("list");
                resetForm();
                return;
            }

            setSaveError(dalMsg(result.error, "Failed to delete ruleset."));
        } finally {
            setSaving(false);
        }
    };

    const handleCancelForm = () => {
        setView("list");
        resetForm();
    };

    // ── render ─────────────────────────────────────────────────────────────

    if (view !== "list") {
        const isEdit = view === "edit";
        return (
            <div className="ruleset-editor">
                <div className="ruleset-editor__header">
                    <h3 className="ruleset-editor__title">
                        {isEdit ? "Edit Ruleset" : "New Ruleset"}
                    </h3>
                    <div className="ruleset-editor__header-actions">
                        <button
                            type="button"
                            className="ruleset-editor__cancel"
                            onClick={handleCancelForm}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        {isEdit && (
                            <button
                                type="button"
                                className="ruleset-editor__delete"
                                onClick={() => void handleDelete()}
                                disabled={saving}
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>

                <div className="ruleset-editor__section">
                    <div className="ruleset-editor__field">
                        <label>Effective date</label>
                        <input
                            type="date"
                            aria-label="Ruleset effective date"
                            value={effectiveDate}
                            onChange={(e) => setEffectiveDate(e.target.value)}
                        />
                    </div>
                </div>

                {/* OT segmented control */}
                <div className="ruleset-editor__section">
                    <p className="ruleset-editor__section-label">
                        Overtime Rule
                    </p>
                    <div
                        className="ruleset-editor__segmented"
                        role="group"
                        aria-label="Overtime rule type"
                    >
                        {(
                            [
                                ["none", "None"],
                                ["daily", "Daily OT"],
                                ["weekly", "Weekly OT"],
                            ] as [OTMode, string][]
                        ).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                className={`ruleset-editor__segment${
                                    otMode === value
                                        ? " ruleset-editor__segment--active"
                                        : ""
                                }`}
                                onClick={() => handleOTModeChange(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {otRule && (
                        <OTRuleFields
                            form={otRule}
                            onChange={(updated) =>
                                setOTRule(updated as DailyOTForm | WeeklyOTForm)
                            }
                        />
                    )}
                </div>

                {/* Non-OT rules */}
                <div className="ruleset-editor__section">
                    <p className="ruleset-editor__section-label">
                        Additional Rules
                    </p>

                    {overlapWarning && (
                        <div className="ruleset-editor__warning" role="alert">
                            ⚠ {overlapWarning}
                        </div>
                    )}

                    {nonOTRules.map((rule, i) => (
                        <NonOTRuleRow
                            key={rule.ruleId}
                            form={rule}
                            onChange={(updated) => updateNonOTRule(i, updated)}
                            onRemove={() => removeNonOTRule(i)}
                        />
                    ))}

                    <div className="ruleset-editor__add-rule-row">
                        {(
                            [
                                ["meal-penalty", "Meal Penalty"],
                                ["holiday-rate", "Holiday Rate"],
                                ["time-window-multiplier", "Time Window"],
                                ["custom", "Custom"],
                            ] as [NonOTForm["type"], string][]
                        ).map(([type, label]) => (
                            <button
                                key={type}
                                type="button"
                                className="ruleset-editor__add-rule"
                                onClick={() => addNonOTRule(type)}
                            >
                                + {label}
                            </button>
                        ))}
                    </div>
                </div>

                {saveError && (
                    <div className="ruleset-editor__error" role="alert">
                        {saveError}
                    </div>
                )}

                <div className="ruleset-editor__footer">
                    <button
                        type="button"
                        className="ruleset-editor__save"
                        disabled={saving}
                        onClick={handleSave}
                    >
                        {saving
                            ? isEdit
                                ? "Updating..."
                                : "Saving..."
                            : isEdit
                              ? "Update Ruleset"
                              : "Save Ruleset"}
                    </button>
                </div>
            </div>
        );
    }

    // list view
    return (
        <div className="ruleset-editor">
            <div className="ruleset-editor__header">
                <h3 className="ruleset-editor__title">Pay Rulesets</h3>
                <button
                    type="button"
                    className="ruleset-editor__new-btn"
                    onClick={beginCreate}
                >
                    + New Ruleset
                </button>
            </div>

            <div className="ruleset-editor__list">
                {rulesets.map((rs, i) => (
                    <div
                        key={rs.rulesetId}
                        className="ruleset-editor__card-wrapper"
                        data-testid="ruleset-card"
                        data-effective-date={rs.effectiveDate}
                        role="button"
                        tabIndex={0}
                        aria-label={`Edit ruleset effective ${rs.effectiveDate}`}
                        onClick={() => beginEdit(rs)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                beginEdit(rs);
                            }
                        }}
                    >
                        <RulesetCard ruleset={rs} isActive={i === 0} />
                    </div>
                ))}
            </div>
        </div>
    );
};
