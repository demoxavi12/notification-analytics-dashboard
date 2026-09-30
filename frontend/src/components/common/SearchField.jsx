import { useId, useState } from 'react';
import { Search, X } from 'lucide-react';

// Submit-on-Enter search (one request per search, no debounce needed) with a clear button.
// `value` is the applied search term; the draft is local until submitted.
// Remount (via `key`) to resync the draft when the applied value changes externally.
const SearchField = ({ value, onSearch, label, placeholder }) => {
  const inputId = useId();
  const [draft, setDraft] = useState(value);

  const submit = (e) => {
    e.preventDefault();
    const next = draft.trim();
    if (next !== value) onSearch(next);
  };

  const clear = () => {
    setDraft('');
    if (value) onSearch('');
  };

  return (
    <form className="search-field" role="search" onSubmit={submit}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search size={16} className="search-field-icon" aria-hidden="true" />
      <input
        id={inputId}
        type="search"
        className="input"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={100}
        enterKeyHint="search"
      />
      {draft && (
        <button type="button" className="icon-btn search-field-clear" onClick={clear} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
      <button type="submit" className="btn btn-secondary btn-sm search-field-submit">
        Search
      </button>
    </form>
  );
};

export default SearchField;
