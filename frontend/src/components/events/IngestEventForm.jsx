import { useId, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../services/api';
import { EVENT_SERVICES, EVENT_STATUSES } from '../../utils/domainLabels';

// Form for the existing "Ingest event" feature (POST /events). Validation mirrors
// the backend contract: eventType + service required, service from the enum,
// metadata must be a JSON object.
const EVENT_TYPE_PATTERN = /^[a-z0-9]+([._-][a-z0-9]+)*$/i;

const INITIAL = {
  eventType: 'payment.success',
  service: 'payment-service',
  status: 'success',
  source: '',
  metadata: '{\n  "amount": 99.0,\n  "currency": "USD"\n}',
};

const IngestEventForm = ({ onSubmit, onCancel }) => {
  const ids = { type: useId(), service: useId(), status: useId(), source: useId(), metadata: useId() };
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

    const nextErrors = {};
    const eventType = values.eventType.trim();
    if (!eventType) nextErrors.eventType = 'Event type is required.';
    else if (!EVENT_TYPE_PATTERN.test(eventType) || eventType.length > 100) {
      nextErrors.eventType = 'Use letters, numbers and . _ - separators, e.g. payment.success';
    }

    let metadata = {};
    if (values.metadata.trim()) {
      try {
        metadata = JSON.parse(values.metadata);
        if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
          nextErrors.metadata = 'Metadata must be a JSON object, e.g. { "key": "value" }.';
        }
      } catch {
        nextErrors.metadata = 'Metadata is not valid JSON.';
      }
    }

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }

    lockRef.current = true;
    setIsSubmitting(true);
    try {
      await onSubmit({
        eventType,
        service: values.service,
        status: values.status,
        source: values.source.trim() || undefined,
        metadata,
      });
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'The event could not be ingested.'));
      lockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="modal-form">
      {formError && (
        <div className="form-alert" role="alert">
          {formError}
        </div>
      )}

      <div className="input-group">
        <label className="input-label" htmlFor={ids.type}>
          Event type
        </label>
        <input
          id={ids.type}
          className={`input${errors.eventType ? ' input-invalid' : ''}`}
          value={values.eventType}
          onChange={setField('eventType')}
          aria-invalid={Boolean(errors.eventType) || undefined}
          aria-describedby={errors.eventType ? `${ids.type}-error` : undefined}
          autoComplete="off"
          spellCheck={false}
          data-autofocus
        />
        {errors.eventType && (
          <span id={`${ids.type}-error`} className="field-error">
            {errors.eventType}
          </span>
        )}
      </div>

      <div className="form-row">
        <div className="input-group">
          <label className="input-label" htmlFor={ids.service}>
            Service
          </label>
          <select id={ids.service} className="select" value={values.service} onChange={setField('service')}>
            {Object.entries(EVENT_SERVICES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor={ids.status}>
            Status
          </label>
          <select id={ids.status} className="select" value={values.status} onChange={setField('status')}>
            {Object.entries(EVENT_STATUSES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor={ids.source}>
          Source <span className="detail-muted">(optional)</span>
        </label>
        <input
          id={ids.source}
          className="input"
          value={values.source}
          onChange={setField('source')}
          placeholder="Defaults to “api”"
          maxLength={100}
          autoComplete="off"
        />
      </div>

      <div className="input-group">
        <label className="input-label" htmlFor={ids.metadata}>
          Metadata (JSON)
        </label>
        <textarea
          id={ids.metadata}
          className={`input code-input${errors.metadata ? ' input-invalid' : ''}`}
          rows={6}
          value={values.metadata}
          onChange={setField('metadata')}
          aria-invalid={Boolean(errors.metadata) || undefined}
          aria-describedby={errors.metadata ? `${ids.metadata}-error` : undefined}
          spellCheck={false}
        />
        {errors.metadata && (
          <span id={`${ids.metadata}-error`} className="field-error">
            {errors.metadata}
          </span>
        )}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Ingesting…' : 'Ingest event'}
        </button>
      </div>
    </form>
  );
};

export default IngestEventForm;
