type EntryFormAutocompleteListProps = {
    ariaLabel: string;
    suggestions: string[];
    selectedIndex: number;
    onSelect: (suggestion: string) => void;
};

export const EntryFormAutocompleteList: React.FC<
    EntryFormAutocompleteListProps
> = ({ ariaLabel, suggestions, selectedIndex, onSelect }) => {
    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div
            className="entry-form__autocomplete-list"
            role="listbox"
            aria-label={ariaLabel}
            title={ariaLabel}
        >
            {suggestions.map((suggestion, idx) => (
                <div
                    key={suggestion}
                    role="option"
                    aria-label={suggestion}
                    title={suggestion}
                    className={`entry-form__autocomplete-item ${
                        idx === selectedIndex
                            ? "entry-form__autocomplete-item--selected"
                            : ""
                    }`}
                    onClick={() => onSelect(suggestion)}
                >
                    {suggestion}
                </div>
            ))}
        </div>
    );
};
