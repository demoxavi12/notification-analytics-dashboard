// Label/value pairs for detail views, rendered as a description list.
// items: [{ label, value, wide? }] — falsy values are skipped.
export const DetailList = ({ items }) => (
  <dl className="detail-list">
    {items
      .filter((item) => item && item.value !== null && item.value !== undefined && item.value !== '')
      .map((item) => (
        <div key={item.label} className={`detail-item${item.wide ? ' detail-item--wide' : ''}`}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
  </dl>
);

// Read-only JSON viewer for metadata payloads. Rendered as text (never as HTML).
export const JsonBlock = ({ value, label }) => {
  const isEmpty = !value || (typeof value === 'object' && Object.keys(value).length === 0);
  return (
    <div className="json-block">
      <h3 className="detail-subheading">{label}</h3>
      {isEmpty ? (
        <p className="detail-muted">No metadata was recorded.</p>
      ) : (
        <pre className="code-block" tabIndex={0} aria-label={label}>
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
};
