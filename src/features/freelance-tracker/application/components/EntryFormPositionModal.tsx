type PositionDraft = {
    name: string;
    defaultRate: string;
};

type EntryFormPositionModalProps = {
    organizationName: string;
    draft: PositionDraft;
    error: string | null;
    isSaving: boolean;
    onChangeDraft: (next: PositionDraft) => void;
    onCancel: () => void;
    onSave: () => void;
};

export const EntryFormPositionModal: React.FC<EntryFormPositionModalProps> = ({
    organizationName,
    draft,
    error,
    isSaving,
    onChangeDraft,
    onCancel,
    onSave,
}) => {
    return (
        <div className="entry-form__modal-backdrop" role="presentation">
            <div
                className="entry-form__modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="entry-form-position-modal-title"
            >
                <h3 id="entry-form-position-modal-title">
                    New Position for {organizationName}
                </h3>

                <div className="entry-form__field">
                    <label htmlFor="new-position-name">Position Name</label>
                    <input
                        id="new-position-name"
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
                    <label htmlFor="new-position-default-rate">
                        Default Hourly Rate (optional)
                    </label>
                    <input
                        id="new-position-default-rate"
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.defaultRate}
                        onChange={(event) =>
                            onChangeDraft({
                                ...draft,
                                defaultRate: event.target.value,
                            })
                        }
                    />
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
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
};
