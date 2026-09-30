import { formatCount, formatPercent, humanizeIdentifier } from '../../utils/formatters';

// Horizontal bar breakdown. Every row states its label, count and share as text,
// so the bars (and their colors) are purely decorative.
const BreakdownList = ({ items, label, getLabel = humanizeIdentifier, getColor = () => 'var(--primary)' }) => {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <ul className="breakdown-list" aria-label={label}>
      {items.map((item) => {
        const share = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <li key={item.name} className="breakdown-item">
            <div className="breakdown-row">
              <span className="breakdown-label" title={item.name}>
                {getLabel(item.name)}
              </span>
              <span className="breakdown-value">
                {formatCount(item.value)}
                <span className="breakdown-share"> · {formatPercent(share, 0)}</span>
              </span>
            </div>
            <div className="breakdown-track" aria-hidden="true">
              <div className="breakdown-bar" style={{ width: `${Math.max(share, 2)}%`, backgroundColor: getColor(item.name) }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default BreakdownList;
