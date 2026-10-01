import { useNavigate } from 'react-router-dom';
import { Compass, Home, ArrowLeft } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

const NotFoundPage = () => {
  useDocumentTitle('Page not found');
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'var(--bg-primary)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '48px 32px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <Compass size={36} />
        </div>

        <h1 style={{ fontSize: '48px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
          404
        </h1>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '8px' }}>
          Endpoint Not Found
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '12px', marginBottom: '28px' }}>
          The requested page or SaaS resource does not exist or has been relocated to another route.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">
            <ArrowLeft size={16} /> Go Back
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            <Home size={16} /> Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
