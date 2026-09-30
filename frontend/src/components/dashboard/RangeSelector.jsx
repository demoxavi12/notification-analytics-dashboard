import { useId } from 'react';

// Segmented control built on native radio inputs, so arrow-key navigation and
// screen-reader semantics ("Time range, radio group, 7d, 2 of 3") come for free.
const RangeSelector = ({ value, options, onChange, disabled = false }) => {
  const name = useId();
  return (
    <fieldset className="segmented" disabled={disabled}>
      <legend className="sr-only">Time range</legend>
      {Object.entries(options).map(([key, option]) => (
        <label key={key} className="segmented-option" title={option.description}>
          <input
            type="radio"
            className="sr-only"
            name={name}
            value={key}
            checked={value === key}
            onChange={() => onChange(key)}
          />
          <span aria-hidden="true">{option.label}</span>
          <span className="sr-only">{option.description}</span>
        </label>
      ))}
    </fieldset>
  );
};

export default RangeSelector;
