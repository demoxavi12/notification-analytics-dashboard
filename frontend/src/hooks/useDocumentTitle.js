import { useEffect } from 'react';

const APP_NAME = 'PulseOps';

// Sets a distinct browser-tab title per page ("Events · PulseOps"), which is also
// what screen readers announce on navigation (WCAG 2.4.2 Page Titled).
const useDocumentTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
};

export default useDocumentTitle;
