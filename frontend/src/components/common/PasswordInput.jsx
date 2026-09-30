import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

// Password field with the leading lock icon used across the auth pages and a
// show/hide toggle. Extra props (onBlur, aria-*, etc.) pass through to <input>.
const PasswordInput = ({ id, value, onChange, invalid = false, inputRef, className = '', ...inputProps }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        ref={inputRef}
        type={isVisible ? 'text' : 'password'}
        className={`input${invalid ? ' input-invalid' : ''} ${className}`.trim()}
        style={{ width: '100%', paddingLeft: '36px', paddingRight: '40px' }}
        value={value}
        onChange={onChange}
        aria-invalid={invalid || undefined}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...inputProps}
      />
      <Lock
        size={16}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
        }}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={isVisible ? 'Hide password' : 'Show password'}
        aria-pressed={isVisible}
        aria-controls={id}
        title={isVisible ? 'Hide password' : 'Show password'}
      >
        {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

export default PasswordInput;
