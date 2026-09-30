import { useId } from 'react';

// Labelled <select> for filter bars. `options` is [{ value, label }].
const FilterSelect = ({ label, value, options, onChange, disabled = false }) => {
  const id = useId();
  return (
    <div className="filter-field">
      <label htmlFor={id} className="filter-label">
        {label}
      </label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default FilterSelect;
