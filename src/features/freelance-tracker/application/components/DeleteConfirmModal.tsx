type DeleteConfirmModalProps = {
    onConfirm: () => void;
    onCancel: () => void;
};

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
    onConfirm,
    onCancel,
}) => (
    <div className="entry-history__modal-overlay">
        <div className="entry-history__modal">
            <h3>Delete Entry?</h3>
            <p>This action cannot be undone.</p>
            <div className="entry-history__modal-actions">
                <button
                    className="entry-history__modal-cancel"
                    onClick={onCancel}
                >
                    Cancel
                </button>
                <button
                    className="entry-history__modal-confirm"
                    onClick={onConfirm}
                >
                    Delete
                </button>
            </div>
        </div>
    </div>
);
