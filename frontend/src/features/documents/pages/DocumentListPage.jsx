import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Sparkles,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { documentsApi } from '../api';
import DocStatusBadges from '../../../components/DocStatusBadges';
import GenerateDocModal from '../components/GenerateDocModal';
import { DOCUMENT_STATUS } from '../../../constants/documentStatus';

export default function DocumentListPage({ onNavigate, userRole = 'Developer' }) {
  const { t, formatDate, lang } = useI18n();

  const [documents, setDocuments] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const size = 20;

  // Filter state
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Status state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await documentsApi.getDocuments({
        repositoryId: selectedRepo || undefined,
        docStatus: selectedStatus || undefined,
        page,
        size,
      });
      setDocuments(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Lỗi khi tải danh sách tài liệu'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedRepo, selectedStatus, page, size]);

  // Load repositories once
  useEffect(() => {
    const loadRepos = async () => {
      try {
        const repoList = await documentsApi.getRepositories();
        setRepositories(repoList || []);
      } catch {
        // Fallback or ignore
      }
    };
    loadRepos();
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Client-side search filtering by title or path
  const filteredDocs = documents.filter((doc) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const titleMatch = (doc.title || '').toLowerCase().includes(term);
    const pathMatch = (doc.pathInRepo || doc.path || '').toLowerCase().includes(term);
    return titleMatch || pathMatch;
  });

  const totalPages = Math.ceil(total / size) || 1;
  const canGenerate = userRole === 'Developer' || userRole === 'Technical Lead' || userRole === 'TechLead';

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Page Header */}
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">{t('documents.title')}</h1>
          <p className="ld-page-description">{t('documents.description')}</p>
        </div>

        {canGenerate && (
          <button
            type="button"
            onClick={() => setIsGenerateOpen(true)}
            className="ld-btn ld-btn-primary"
            style={{ padding: '9px 16px', fontSize: '14px' }}
          >
            <Sparkles size={16} />
            {t('documents.btnGenerate')}
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div
        className="ld-card"
        style={{
          marginBottom: '20px',
          padding: '14px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', flex: 1 }}>
          {/* Search box */}
          <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '320px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              className="ld-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('common.search')}
              style={{ paddingLeft: '32px' }}
            />
          </div>

          {/* Repo Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              className="ld-select"
              value={selectedRepo}
              onChange={(e) => {
                setSelectedRepo(e.target.value);
                setPage(0);
              }}
            >
              <option value="">{t('documents.allRepos')}</option>
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '180px' }}>
            <select
              className="ld-select"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">{t('documents.allStatuses')}</option>
              {Object.keys(DOCUMENT_STATUS).map((st) => (
                <option key={st} value={st}>
                  {lang === 'en' ? DOCUMENT_STATUS[st].labelEn : DOCUMENT_STATUS[st].labelVi}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchDocuments}
          disabled={loading}
          className="ld-btn ld-btn-secondary"
          title={t('common.retry')}
        >
          <RefreshCw size={14} className={loading ? 'ld-spin' : ''} />
          {t('common.retry')}
        </button>
      </div>

      {/* Main Content States */}
      {loading ? (
        /* 1. SKELETON LOADING STATE */
        <div className="ld-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div className="ld-skeleton" style={{ width: '40px', height: '36px' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="ld-skeleton" style={{ width: '45%', height: '16px' }} />
                  <div className="ld-skeleton" style={{ width: '25%', height: '12px' }} />
                </div>
                <div className="ld-skeleton" style={{ width: '120px', height: '24px' }} />
                <div className="ld-skeleton" style={{ width: '80px', height: '28px' }} />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        /* 2. ERROR STATE WITH RETRY */
        <div
          className="ld-card"
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            backgroundColor: '#fef2f2',
            borderColor: '#fca5a5',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <AlertCircle size={24} />
          </div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#991b1b' }}>
            {t('documents.errorTitle')}
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#7f1d1d' }}>{error}</p>
          <button
            type="button"
            onClick={fetchDocuments}
            className="ld-btn ld-btn-primary"
            style={{ margin: '0 auto' }}
          >
            <RefreshCw size={14} />
            {t('common.retry')}
          </button>
        </div>
      ) : filteredDocs.length === 0 ? (
        /* 3. EMPTY STATE */
        <div
          className="ld-card"
          style={{
            textAlign: 'center',
            padding: '56px 24px',
            borderStyle: 'dashed',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <FileText size={28} />
          </div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
            {t('documents.emptyTitle')}
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
            {t('documents.emptyDesc')}
          </p>
          {canGenerate && (
            <button
              type="button"
              onClick={() => setIsGenerateOpen(true)}
              className="ld-btn ld-btn-primary"
              style={{ margin: '0 auto' }}
            >
              <Sparkles size={15} />
              {t('documents.btnGenerate')}
            </button>
          )}
        </div>
      ) : (
        /* 4. DATA TABLE */
        <div className="ld-card" style={{ padding: 0 }}>
          <div className="ld-table-wrapper" style={{ border: 'none', borderRadius: 'var(--ld-radius)' }}>
            <table className="ld-table">
              <thead>
                <tr>
                  <th style={{ width: '38%' }}>{t('documents.colTitle')}</th>
                  <th style={{ width: '14%' }}>{t('documents.colType')}</th>
                  <th style={{ width: '28%' }}>{t('documents.colStatus')}</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>{t('documents.colVersion')}</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>{t('documents.colUpdated')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map((doc) => {
                  const path = doc.pathInRepo || doc.path || '';
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => onNavigate && onNavigate('document-detail', { id: doc.id })}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FileCode size={16} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                              {doc.title || 'Untitled Document'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                              {path}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {doc.docType}
                        </span>
                      </td>

                      <td>
                        {/* 3 Independent Status Badges (WF-24) */}
                        <DocStatusBadges
                          docStatus={doc.docStatus}
                          publishStatus={doc.publishStatus}
                          prStatus={doc.prStatus}
                          size="sm"
                          lang={lang}
                        />
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            fontWeight: 600,
                            fontSize: '12px',
                            color: '#0f172a',
                          }}
                        >
                          v{doc.currentVersionNo || 1}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {formatDate(doc.updatedAt || doc.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderTop: '1px solid #e2e8f0',
              fontSize: '13px',
              color: '#64748b',
            }}
          >
            <div>
              {t('common.total')}: <strong>{total}</strong> {t('common.items')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>
                {t('common.page')} <strong>{page + 1}</strong> {t('common.of')} <strong>{totalPages}</strong>
              </span>

              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="ld-btn ld-btn-secondary"
                style={{ padding: '4px 8px' }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="ld-btn ld-btn-secondary"
                style={{ padding: '4px 8px' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Document Modal */}
      <GenerateDocModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        onGenerated={() => {
          fetchDocuments();
        }}
      />
    </div>
  );
}
