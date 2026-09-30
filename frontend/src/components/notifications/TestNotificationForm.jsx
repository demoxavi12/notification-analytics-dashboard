import { useId, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../services/api';
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from '../../utils/domainLabels';

// Existing "dispatch test notification" feature (POST /notifications). No recipient
// is sent, so the backend delivers it to the current user.
const INITIAL = {
  title: 'Cluster Node Scaling Event',
  message: 'Node us-east-worker-4 was automatically provisioned to handle peak traffic.',
  type: 'info',
  channel: 'in-app',
};

const TestNotificationForm = ({ onSubmit, onCancel }) => {
  const ids = { title: useId(), message: useId(), type: useId(), channel: useId() };
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockRef = useRef(false);

  const setField = (field) => (e) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockRef.current) return;
    const title = values.title.trim();
    const message = values.message.trim();
    const nextErrors = {
      title: !title ? 'Title is required.' : title.length > 200 ? 'Title must be 200 characters or fewer.' : '',
      message: !message ? 'Message is required.' : '',
    };
    if (nextErrors.title || nextErrors.message) {
      setErrors(nextErrors);
      return;
    }

    lockRef.current = true;
    setIsSubmitting(true);
    try {
      await onSubmit({ title, message, type: values.type, channel: values.channel });
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'The notification could not be sent.'));
      lockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="modal-form">
      <p className="detail-muted">Sends a notification to your own account to test delivery.</p>
      {formError && (
        <div className="form-alert" role="alert">
          {formError}
        </div>
      )}
      <div className="input-group">
        <label className="input-label" htmlFor={ids.title}>
          Title
        </label>
        <input
          id={ids.title}
          className={`input${errors.title ? ' input-invalid' : ''}`}
          value={values.title}
          onChange={setField('title')}
          maxLength={200}
          aria-invalid={Boolean(errors.title) || undefined}
          aria-describedby={errors.title ? `${ids.title}-error` : undefined}
          data-autofocus
        />
        {errors.title && (
          <span id={`${ids.title}-error`} className="field-error">
            {errors.title}
          </span>
        )}
      </div>
      <div className="input-group">
        <label className="input-label" htmlFor={ids.message}>
          Message
        </label>
        <textarea
          id={ids.message}
          className={`input${errors.message ? ' input-invalid' : ''}`}
          rows={3}
          value={values.message}
          onChange={setField('message')}
          aria-invalid={Boolean(errors.message) || undefined}
          aria-describedby={errors.message ? `${ids.message}-error` : undefined}
        />
        {errors.message && (
          <span id={`${ids.message}-error`} className="field-error">
            {errors.message}
          </span>
        )}
      </div>
      <div className="form-row">
        <div className="input-group">
          <label className="input-label" htmlFor={ids.type}>
            Type
          </label>
          <select id={ids.type} className="select" value={values.type} onChange={setField('type')}>
            {Object.entries(NOTIFICATION_TYPES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor={ids.channel}>
            Channel
          </label>
          <select id={ids.channel} className="select" value={values.channel} onChange={setField('channel')}>
            {Object.entries(NOTIFICATION_CHANNELS).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send notification'}
        </button>
      </div>
    </form>
  );
};

export default TestNotificationForm;
