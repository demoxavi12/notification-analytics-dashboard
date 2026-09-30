// Client-side validation for the public auth forms. The backend remains the
// source of truth; these checks exist to give fast, clear feedback.

// Pragmatic email check: one "@", no whitespace, a dot in the domain, and a
// TLD of at least two letters. Deliberately not a full RFC 5322 parser.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 100; // matches the User model maxlength
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULES = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (pw) => pw.length >= PASSWORD_MIN_LENGTH },
  { id: 'upper', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { id: 'special', label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const normalizeEmail = (email) => email.trim().toLowerCase();

// Trim and collapse internal runs of whitespace ("  Alex   Johnson " -> "Alex Johnson").
export const normalizeName = (name) => name.trim().replace(/\s+/g, ' ');

export const validateEmail = (normalizedEmail) => {
  if (!normalizedEmail) return 'Email is required.';
  if (normalizedEmail.length > EMAIL_MAX_LENGTH) return 'Email address is too long.';
  if (!EMAIL_PATTERN.test(normalizedEmail)) return 'Enter a valid email address (e.g. you@company.com).';
  return '';
};

export const validateName = (normalizedName) => {
  if (!normalizedName) return 'Full name is required.';
  if (normalizedName.length < NAME_MIN_LENGTH) return `Name must be at least ${NAME_MIN_LENGTH} characters.`;
  if (normalizedName.length > NAME_MAX_LENGTH) return `Name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  if (!/\p{L}/u.test(normalizedName)) return 'Name must contain at least one letter.';
  return '';
};

export const validateNewPassword = (password) => {
  if (!password) return 'Password is required.';
  if (password.length > PASSWORD_MAX_LENGTH) return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  const unmet = PASSWORD_RULES.filter((rule) => !rule.test(password));
  if (unmet.length > 0) {
    return `Password needs: ${unmet.map((rule) => rule.label.toLowerCase()).join(', ')}.`;
  }
  return '';
};
