const dayOptions = [
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
    { value: "7", label: "Sunday" },
];

export type OrganizationDraft = {
    name: string;
    payPeriodStartDay: string;
};

type EntryFormOrganizationModalProps = {
    draft: OrganizationDraft;
    error: string | null;
    isSaving: boolean;
    onChangeDraft: (next: OrganizationDraft) => void;
    onCancel: () => void;
    onSave: () => void;
};

export const EntryFormOrganizationModal: React.FC<
    EntryFormOrganizationModalProps
> = ({ draft, error, isSaving, onChangeDraft, onCancel, onSave }) => {
    return (
        <div className="entry-form__modal-backdrop" role="presentation">
            <div
                className="entry-form__modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="entry-form-organization-modal-title"
            >
                <h3 id="entry-form-organization-modal-title">
                    New Organization
                </h3>

                <div className="entry-form__field">
                    <label htmlFor="new-organization-name">
                        Organization Name
                    </label>
                    <input
                        id="new-organization-name"
                        type="text"
                        value={draft.name}
                        onChange={(event) =>
                            onChangeDraft({
                                ...draft,
                                name: event.target.value,
                            })
                        }
                    />
                </div>

                <div className="entry-form__field">
                    <label htmlFor="new-organization-pay-period-start-day">
                        Pay Period Start Day
                    </label>
                    <select
                        id="new-organization-pay-period-start-day"
                        value={draft.payPeriodStartDay}
                        onChange={(event) =>
                            onChangeDraft({
                                ...draft,
                                payPeriodStartDay: event.target.value,
                            })
                        }
                    >
                        {dayOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="entry-form__error" role="alert">
                        {error}
                    </div>
                )}

                <div className="entry-form__modal-actions">
                    <button
                        type="button"
                        className="entry-form__modal-secondary"
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="entry-form__modal-primary"
                        onClick={onSave}
                        disabled={isSaving}
                    >
                        {isSaving ? "Saving..." : "Save Organization"}
                    </button>
                </div>
            </div>
        </div>
    );
};
