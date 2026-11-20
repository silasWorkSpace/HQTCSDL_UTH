import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { FileText, Globe, UserCheck, Shield, CheckSquare, LogIn } from 'lucide-react';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import './styles/livingdocs.css';

// Auth Feature Pages (FR-AUTH-02)
import LoginPage from './features/auth/pages/LoginPage';
import OAuthCallbackPage from './features/auth/pages/OAuthCallbackPage';
import { useAuth } from './features/auth/useAuth';
import { authApi } from './features/auth/authApi';

// Document Feature Pages
import DocumentListPage from './features/documents/pages/DocumentListPage';
import DocumentDetailPage from './features/documents/pages/DocumentDetailPage';
import DraftEditorPage from './features/documents/pages/DraftEditorPage';
import VersionDiffPage from './features/documents/pages/VersionDiffPage';

// Template Feature Pages

// Review Feature Pages (WF-01 to WF-22)
import ReviewQueuePage from './features/reviews/ReviewQueuePage';
import ReviewPage from './features/reviews/ReviewPage';

// Suggestion & Drift Feature Pages (DR-01 to DR-12, AUTO-01 to AUTO-09)
import SuggestionQueuePage from './features/suggestions/SuggestionQueuePage';
import DriftHistoryPage from './features/suggestions/DriftHistoryPage';

function TopNavigation({ activeRole }) {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Local navigation still clears workspace-specific UI state below.
    } finally {
      localStorage.removeItem('ld_token');
      localStorage.removeItem('ld_refresh_token');
      localStorage.removeItem('ld_github_connection_id');
      window.dispatchEvent(new Event('livingdocs:session-changed'));
      navigate('/login', { replace: true });
    }
  };

  return (
    <header
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--ld-border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0 20px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand & Main Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link
            to="/documents"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 800,
              fontSize: '18px',
              color: '#0f172a',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={18} />
            </div>
            {t('common.appName')}
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link
              to="/documents"
              className="ld-btn ld-btn-ghost"
              style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}
            >
              <FileText size={15} />
              {t('nav.documents')}
            </Link>

            {(activeRole === 'Staff' || activeRole === 'Manager' || activeRole === 'Administrator') && (
              <Link
                to="/reviews"
                className="ld-btn ld-btn-ghost"
                style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}
              >
                <CheckSquare size={15} />
                {t('reviews.menu') || 'Hàng đợi duyệt'}
              </Link>
            )}

            {(activeRole === 'Developer' || activeRole === 'Administrator') && (
              <>
                <Link to="/suggestions" className="ld-btn ld-btn-ghost" style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}>Gợi ý drift</Link>
                <Link to="/drift-history" className="ld-btn ld-btn-ghost" style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}>Lịch sử drift</Link>
              </>
            )}

          </nav>
        </div>

        {/* Right Tools: Language & Role Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Language Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Globe size={15} style={{ color: '#64748b' }} />
            <div style={{ display: 'inline-flex', borderRadius: '4px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setLang('vi')}
                style={{
                  padding: '3px 8px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: lang === 'vi' ? '#2563eb' : '#ffffff',
                  color: lang === 'vi' ? '#ffffff' : '#475569',
                }}
              >
                VI
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                style={{
                  padding: '3px 8px',
                  border: 'none',
                  borderLeft: '1px solid #cbd5e1',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: lang === 'en' ? '#2563eb' : '#ffffff',
                  color: lang === 'en' ? '#ffffff' : '#475569',
                }}
              >
                EN
              </button>
            </div>
          </div>

          {/* Role Switcher Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: '#f1f5f9',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            <UserCheck size={14} style={{ color: '#2563eb' }} />
            <span style={{ color: '#64748b' }}>{t('nav.userRole')}:</span>
            <strong style={{ color: '#0f172a' }}>{activeRole || 'Chưa đăng nhập'}</strong>
          </div>

          {/* Login Button (FR-AUTH-02) */}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#1e293b',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <LogIn size={13} style={{ color: '#2563eb' }} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// Route Wrapper Components
function DocumentDetailWrapper({ userRole }) {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <DocumentDetailPage
      documentId={id}
      userRole={userRole}
      onNavigate={(screen, params) => {
        if (screen === 'document-list') navigate('/documents');
        if (screen === 'document-edit') navigate(`/documents/${params.id}/edit`);
        if (screen === 'document-diff') navigate(`/documents/${params.documentId}/diff?from=${params.from}&to=${params.to}`);
      }}
    />
  );
}

function DraftEditorWrapper({ userRole }) {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <DraftEditorPage
      documentId={id}
      userRole={userRole}
      onNavigate={(screen, params) => {
        if (screen === 'document-detail') navigate(`/documents/${params.id}`);
        if (screen === 'document-list') navigate('/documents');
      }}
    />
  );
}

function VersionDiffWrapper() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = Number(searchParams.get('from')) || 1;
  const to = Number(searchParams.get('to')) || 2;

  return (
    <VersionDiffPage
      documentId={id}
      initialFrom={from}
      initialTo={to}
      onNavigate={(screen, params) => {
        if (screen === 'document-detail') navigate(`/documents/${params.id}`);
      }}
    />
  );
}

function AccessDenied() {
  return (
    <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: '32px' }}>
      <Shield size={48} style={{ color: '#dc2626', marginBottom: '16px' }} />
      <h2 style={{ margin: '0 0 8px 0', color: '#991b1b' }}>403 — Không có quyền truy cập</h2>
      <p style={{ color: '#64748b', fontSize: '14px' }}>
        Tài khoản của bạn không có quyền xem trang này. Vui lòng liên hệ quản trị viên.
      </p>
      <Link to="/documents" className="ld-btn ld-btn-primary" style={{ marginTop: '16px' }}>
        Quay lại trang Tài liệu
      </Link>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/auth/callback';
  const { user, roles, loading: authLoading } = useAuth();
  const userRole = ['Administrator', 'Manager', 'Staff', 'Technical Lead', 'Developer']
    .find((role) => roles.includes(role)) || null;

  if (!isAuthPage && authLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#475569', fontSize: 14 }}
      >
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }
  if (!isAuthPage && !user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {!isAuthPage && <TopNavigation activeRole={userRole} />}

      <main style={{ flex: 1 }}>
        <Routes>
          {/* Auth module (FR-AUTH-02) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />

          {/* Documents module */}
              <Route path="/" element={<Navigate to="/documents" replace />} />
              <Route path="/documents" element={<DocumentListPage userRole={userRole} />} />
              <Route path="/documents/:id" element={<DocumentDetailWrapper userRole={userRole} />} />
              <Route
                path="/documents/:id/edit"
                element={<DraftEditorWrapper userRole={userRole} />}
              />
              <Route
                path="/documents/:id/diff"
                element={<VersionDiffWrapper />}
              />

              {/* Templates remain outside the persisted workflow. */}
              <Route path="/templates/*" element={<Navigate to="/documents" replace />} />

              {/* Review Workflow module (WF-01 to WF-22) */}
              <Route path="/reviews" element={<ReviewQueuePage />} />
              <Route path="/reviews/:taskId" element={<ReviewPage />} />

              {/* Suggestion & Drift module (AUTO-01 to AUTO-09, DR-01 to DR-12) */}
              <Route path="/suggestions" element={<SuggestionQueuePage />} />
              <Route path="/drift-history" element={<DriftHistoryPage />} />
              <Route path="/documents/:id/drift" element={<DriftHistoryPage />} />

              <Route path="*" element={<AccessDenied />} />
            </Routes>
          </main>
        </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </I18nProvider>
  );
}
