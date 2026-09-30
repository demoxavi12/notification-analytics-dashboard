import { useRef, useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { Activity, Mail, User, ArrowRight, Check, Circle } from "lucide-react";
import { useAuth } from "../context/useAuth";
import PasswordInput from "../components/common/PasswordInput";
import {
  PASSWORD_RULES,
  normalizeEmail,
  normalizeName,
  validateEmail,
  validateName,
  validateNewPassword,
} from "../utils/authValidation";

const EMPTY_ERRORS = { name: "", email: "", password: "" };

const iconStyle = {
  position: "absolute",
  left: "12px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "var(--text-muted)",
};

const RegisterPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS);
  const [formError, setFormError] = useState("");

  // State updates are async, so a fast double-click/Enter could slip past
  // `disabled`. The ref blocks a second submit synchronously.
  const submitLockRef = useRef(false);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const { register, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Editing a field clears that field's error plus any stale server error.
  const handleFieldChange = (field, setter) => (e) => {
    setter(e.target.value);
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: "" } : prev));
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current) return;

    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);

    const errors = {
      name: validateName(normalizedName),
      email: validateEmail(normalizedEmail),
      password: validateNewPassword(password),
    };

    if (errors.name || errors.email || errors.password) {
      setFieldErrors(errors);
      setFormError("");
      const firstInvalid = errors.name ? nameRef : errors.email ? emailRef : passwordRef;
      firstInvalid.current?.focus();
      return;
    }

    // Reflect the normalized values back in the form.
    setName(normalizedName);
    setEmail(normalizedEmail);

    submitLockRef.current = true;
    setIsSubmitting(true);
    setFieldErrors(EMPTY_ERRORS);
    setFormError("");

    try {
      // Only name/email/password are sent. Public sign-ups never choose a role;
      // the server assigns the default "user" role.
      const res = await register({
        name: normalizedName,
        email: normalizedEmail,
        password,
      });

      if (res.success) {
        navigate("/dashboard", { replace: true });
        return;
      }

      if (res.code === "USER_EXISTS" || res.status === 409) {
        setFieldErrors({ ...EMPTY_ERRORS, email: res.error || "An account with this email already exists." });
        emailRef.current?.focus();
      } else {
        setFormError(res.error || "Registration failed. Please try again.");
      }
    } catch {
      setFormError("Unable to create your account. Please try again.");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const showPasswordRules = password.length > 0 || Boolean(fieldErrors.password);

  // Already signed in: registration makes no sense, go to the app.
  // While submitting, handleSubmit performs the navigation itself.
  if (!isLoading && isAuthenticated && !isSubmitting) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        backgroundColor: "var(--bg-primary)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-lg)",
          padding: "36px 32px",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "var(--primary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              marginBottom: "12px",
            }}
          >
            <Activity size={28} />
          </div>

          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Create an Account
          </h1>

          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              marginTop: "4px",
            }}
          >
            Start monitoring services and event pipelines
          </p>
        </div>

        {/* Form-level (server/network) error */}
        {formError && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--error-bg)",
              color: "var(--error)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
          {/* Full Name */}
          <div className="input-group">
            <label className="input-label" htmlFor="register-name">
              Full Name
            </label>

            <div style={{ position: "relative" }}>
              <input
                id="register-name"
                ref={nameRef}
                type="text"
                className={`input${fieldErrors.name ? " input-invalid" : ""}`}
                style={{
                  width: "100%",
                  paddingLeft: "36px",
                }}
                placeholder="e.g. Alex Johnson"
                value={name}
                onChange={handleFieldChange("name", setName)}
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.name) || undefined}
                aria-describedby={fieldErrors.name ? "register-name-error" : undefined}
                required
              />

              <User size={16} aria-hidden="true" style={iconStyle} />
            </div>

            {fieldErrors.name && (
              <span id="register-name-error" className="field-error">
                {fieldErrors.name}
              </span>
            )}
          </div>

          {/* Email */}
          <div className="input-group">
            <label className="input-label" htmlFor="register-email">
              Email Address
            </label>

            <div style={{ position: "relative" }}>
              <input
                id="register-email"
                ref={emailRef}
                type="email"
                inputMode="email"
                className={`input${fieldErrors.email ? " input-invalid" : ""}`}
                style={{
                  width: "100%",
                  paddingLeft: "36px",
                }}
                placeholder="you@company.com"
                value={email}
                onChange={handleFieldChange("email", setEmail)}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(fieldErrors.email) || undefined}
                aria-describedby={fieldErrors.email ? "register-email-error" : undefined}
                required
              />

              <Mail size={16} aria-hidden="true" style={iconStyle} />
            </div>

            {fieldErrors.email && (
              <span id="register-email-error" className="field-error">
                {fieldErrors.email}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="input-group">
            <label className="input-label" htmlFor="register-password">
              Password
            </label>

            <PasswordInput
              id="register-password"
              inputRef={passwordRef}
              placeholder="••••••••••••"
              value={password}
              onChange={handleFieldChange("password", setPassword)}
              autoComplete="new-password"
              invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                [fieldErrors.password && "register-password-error", "register-password-rules"]
                  .filter(Boolean)
                  .join(" ")
              }
              required
            />

            {fieldErrors.password && (
              <span id="register-password-error" className="field-error">
                {fieldErrors.password}
              </span>
            )}

            {/* Live requirements checklist; always in the DOM for screen readers */}
            <ul
              id="register-password-rules"
              aria-label="Password requirements"
              style={{
                display: showPasswordRules ? "grid" : "none",
                gridTemplateColumns: "1fr 1fr",
                gap: "4px 12px",
                listStyle: "none",
                margin: "2px 0 0",
                padding: 0,
                fontSize: "12px",
              }}
            >
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password);
                return (
                  <li
                    key={rule.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: met ? "var(--success)" : "var(--text-muted)",
                    }}
                  >
                    {met ? <Check size={12} aria-hidden="true" /> : <Circle size={10} aria-hidden="true" />}
                    <span>
                      {rule.label}
                      <span className="sr-only">{met ? " (met)" : " (not met)"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Register Button */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: "100%",
              padding: "10px 16px",
              fontSize: "15px",
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Creating Account..."
            ) : (
              <>
                Register Account
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Login Link */}
        <div
          style={{
            textAlign: "center",
            marginTop: "20px",
            fontSize: "13px",
            color: "var(--text-secondary)",
          }}
        >
          Already have an account?{" "}
          <Link
            to="/login"
            style={{
              color: "var(--primary)",
              fontWeight: 500,
            }}
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
