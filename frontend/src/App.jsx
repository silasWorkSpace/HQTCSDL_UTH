import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FileText, FileCode2, Globe, UserCheck, Shield } from 'lucide-react';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import './styles/livingdocs.css';

// Document Feature Pages
import DocumentListPage from './features/documents/pages/DocumentListPage';
import DocumentDetailPage from './features/documents/pages/DocumentDetailPage';
import DraftEditorPage from './features/documents/pages/DraftEditorPage';
import VersionDiffPage from './features/documents/pages/VersionDiffPage';

// Template Feature Pages
import TemplateListPage from './features/templates/pages/TemplateListPage';
import TemplateEditorPage from './features/templates/pages/TemplateEditorPage';

const SYSTEM_ROLES = ['Developer', 'Technical Lead', 'Staff', 'Manager', 'Administrator'];

function TopNavigation({ activeRole, onRoleChange }) {
  const { t, lang, setLang } = useI18n();

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

            {activeRole !== 'Administrator' && (
              <Link
                to="/templates"
                className="ld-btn ld-btn-ghost"
                style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600 }}
              >
                <FileCode2 size={15} />
                {t('nav.templates')}
              </Link>
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
            <select
              value={activeRole}
              onChange={(e) => onRoleChange(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontWeight: 600,
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {SYSTEM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
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

function TemplateEditorWrapper({ userRole }) {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <TemplateEditorPage
      templateId={id}
      isCreate={!id}
      userRole={userRole}
      onNavigate={(screen) => {
        if (screen === 'template-list') navigate('/templates');
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
        Tài khoản của bạn không có quyền xem trang này. Vui lòng liên hệ quản trị viên hoặc chuyển đổi vai trò.
      </p>
      <Link to="/documents" className="ld-btn ld-btn-primary" style={{ marginTop: '16px' }}>
        Quay lại trang Tài liệu
      </Link>
    </div>
  );
}

export default function App() {
  const [userRole, setUserRole] = useState('Developer');

  return (
    <I18nProvider>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <TopNavigation activeRole={userRole} onRoleChange={setUserRole} />

          <main style={{ flex: 1 }}>
            <Routes>
              {/* Documents module */}
              <Route
                path="/"
                element={
                  userRole === 'Administrator' ? (
                    <AccessDenied />
                  ) : (
                    <DocumentListPage
                      userRole={userRole}
                      onNavigate={(screen, params) => {
                        window.location.href = `/documents/${params.id}`;
                      }}
                    />
                  )
                }
              />
              <Route
                path="/documents"
                element={
                  userRole === 'Administrator' ? (
                    <AccessDenied />
                  ) : (
                    <DocumentListPage
                      userRole={userRole}
                      onNavigate={(screen, params) => {
                        window.location.href = `/documents/${params.id}`;
                      }}
                    />
                  )
                }
              />
              <Route
                path="/documents/:id"
                element={
                  userRole === 'Administrator' ? (
                    <AccessDenied />
                  ) : (
                    <DocumentDetailWrapper userRole={userRole} />
                  )
                }
              />
              <Route
                path="/documents/:id/edit"
                element={<DraftEditorWrapper userRole={userRole} />}
              />
              <Route
                path="/documents/:id/diff"
                element={<VersionDiffWrapper />}
              />

              {/* Templates module */}
              <Route
                path="/templates"
                element={
                  userRole === 'Administrator' ? (
                    <AccessDenied />
                  ) : (
                    <TemplateListPage
                      userRole={userRole}
                      onNavigate={(screen, params) => {
                        if (screen === 'template-create') window.location.href = '/templates/new';
                        if (screen === 'template-edit') window.location.href = `/templates/${params.id}`;
                      }}
                    />
                  )
                }
              />
              <Route
                path="/templates/new"
                element={<TemplateEditorWrapper userRole={userRole} />}
              />
              <Route
                path="/templates/:id"
                element={<TemplateEditorWrapper userRole={userRole} />}
              />

              <Route path="*" element={<AccessDenied />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </I18nProvider>
  );
}
