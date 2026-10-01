import { Component } from 'react';
import StateMessage from './StateMessage';

// Route-level boundary: if a page throws while rendering, show an error in the page
// area instead of unmounting the whole app (the sidebar/navbar stay usable).
// It does not hide the problem: the error is logged and shown, and the boundary
// resets when `resetKey` changes (e.g. on navigation).
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Page failed to render:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <StateMessage
          tone="error"
          announce
          className="card"
          title="This page couldn’t be displayed"
          message="Something went wrong while rendering this page. Other pages still work."
          action={
            <button type="button" className="btn btn-outline btn-sm" onClick={() => window.location.reload()}>
              Reload page
            </button>
          }
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
