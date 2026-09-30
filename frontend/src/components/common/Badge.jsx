const Badge = ({ type = 'neutral', text, children, icon: Icon }) => {
  let badgeClass = 'badge badge-neutral';

  if (type === 'success' || type === 'delivered' || type === 'active') {
    badgeClass = 'badge badge-success';
  } else if (type === 'warning' || type === 'pending') {
    badgeClass = 'badge badge-warning';
  } else if (type === 'error' || type === 'failed' || type === 'suspended') {
    badgeClass = 'badge badge-error';
  } else if (type === 'info' || type === 'admin') {
    badgeClass = 'badge badge-info';
  }

  return (
    <span className={badgeClass}>
      {Icon && <Icon size={12} />}
      {text || children}
    </span>
  );
};

export default Badge;
