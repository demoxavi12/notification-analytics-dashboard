import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCount } from '../../utils/formatters';

// Previous/next pagination with a range summary and optional page-size picker.
const Pagination = ({ pagination, onPageChange, pageSizes, onPageSizeChange, itemLabel = 'items', disabled = false }) => {
  const sizeId = useId();
  if (!pagination) return null;
  const { page, limit, total, totalPages, hasPrevPage, hasNextPage } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav className="pagination" aria-label={`${itemLabel} pagination`}>
      <p className="pagination-summary" aria-live="polite">
        {total === 0 ? (
          `No ${itemLabel}`
        ) : (
          <>
            <strong>{formatCount(from)}–{formatCount(to)}</strong> of <strong>{formatCount(total)}</strong> {itemLabel}
            <span className="pagination-page"> · Page {page} of {totalPages}</span>
          </>
        )}
      </p>

      <div className="pagination-controls">
        {pageSizes && onPageSizeChange && (
          <div className="pagination-size">
            <label htmlFor={sizeId}>Per page</label>
            <select
              id={sizeId}
              className="select"
              value={limit}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={disabled}
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || !hasPrevPage}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="pagination-btn-text">Previous</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || !hasNextPage}
          aria-label="Next page"
        >
          <span className="pagination-btn-text">Next</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
