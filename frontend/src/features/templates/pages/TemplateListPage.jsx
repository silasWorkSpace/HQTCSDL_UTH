import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCode2,
  Plus,
  Copy,
  Edit,
  RefreshCw,
  FolderTree,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { templatesApi } from '../api';

const DOC_TYPES = ['API_REFERENCE', 'README', 'MODULE_GUIDE', 'ONBOARDING_GUIDE', 'ADR', 'OTHER'];
const TEMPLATE_STATUSES = ['ACTIVE', 'DRAFT', 'ARCHIVED'];

export default function TemplateListPage({ onNavigate, userRole = 'Developer' }) {
  const { t, formatDate } = useI18n();

  const [templates, setTemplates] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedDocType, setSelectedDocType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'collections'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Clone Modal
  const [cloneModalTpl, setCloneModalTpl] = useState(null);
  const [cloneName, setCloneName] = useState('');

  const isTechLead = userRole === 'Technical Lead' || userRole === 'TechLead' || userRole === 'Administrator';

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tplList, colList] = await Promise.all([
        templatesApi.getTemplates({ docType: selectedDocType || undefined, status: selectedStatus || undefined }),
        templatesApi.getCollections(),
      ]);
      setTemplates(tplList);
      setCollections(colList);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Lỗi khi tải danh sách template');
    } finally {
      setLoading(false);
    }
  }, [selectedDocType, selectedStatus]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCloneSubmit = async (e) => {
    e.preventDefault();
    if (!cloneModalTpl || !cloneName.trim()) return;
    try {
      await templatesApi.cloneTemplate(cloneModalTpl.id, cloneName.trim());
      setCloneModalTpl(null);
      setCloneName('');
      fetchTemplates();
    } catch (err) {
      alert('Lỗi nhân bản: ' + (err?.response?.data?.detail || err.message));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return { bg: '#dcfce7', text: '#166534', border: '#86efac', label: 'Hoạt động (ACTIVE)' };
      case 'ARCHIVED':
        return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', label: 'Lưu trữ (ARCHIVED)' };
      default:
        return { bg: '#fef9c3', text: '#854d0e', border: '#fde047', label: 'Bản nháp (DRAFT)' };
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div className="ld-page-header">
        <div>
          <h1 className="ld-page-title">{t('templates.title')}</h1>
          <p className="ld-page-description">{t('templates.description')}</p>
        </div>

        {isTechLead && (
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('template-create')}
            className="ld-btn ld-btn-primary"
            style={{ padding: '9px 16px', fontSize: '14px' }}
          >
            <Plus size={16} />
            {t('templates.btnCreate')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '8px', marginBottom: '18px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'templates' ? '#2563eb' : '#64748b',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <FileCode2 size={16} />
          {t('templates.title')} ({templates.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('collections')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'collections' ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === 'collections' ? '#2563eb' : '#64748b',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <FolderTree size={16} />
          {t('templates.collectionsTitle')} ({collections.length})
        </button>
      </div>

      {activeTab === 'templates' && (
        <>
          {/* Filters Bar */}
          <div
            className="ld-card"
            style={{
              marginBottom: '20px',
              padding: '12px 18px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              <div style={{ minWidth: '180px' }}>
                <select
                  className="ld-select"
                  value={selectedDocType}
                  onChange={(e) => setSelectedDocType(e.target.value)}
                >
                  <option value="">Tất cả loại tài liệu</option>
                  {DOC_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ minWidth: '160px' }}>
                <select
                  className="ld-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">Tất cả trạng thái</option>
                  {TEMPLATE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchTemplates}
              disabled={loading}
              className="ld-btn ld-btn-secondary"
            >
              <RefreshCw size={14} className={loading ? 'ld-spin' : ''} />
              {t('common.retry')}
            </button>
          </div>

          {/* Main State */}
          {loading ? (
            <div className="ld-card" style={{ padding: '24px' }}>
              <div className="ld-skeleton" style={{ height: '300px' }} />
            </div>
          ) : error ? (
            <div
              className="ld-card"
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                backgroundColor: '#fef2f2',
                borderColor: '#fca5a5',
              }}
            >
              <AlertCircle size={32} style={{ color: '#dc2626', margin: '0 auto 8px' }} />
              <h4 style={{ margin: '0 0 6px', color: '#991b1b' }}>{error}</h4>
              <button
                type="button"
                onClick={fetchTemplates}
                className="ld-btn ld-btn-primary"
                style={{ margin: '12px auto 0' }}
              >
                {t('common.retry')}
              </button>
            </div>
          ) : templates.length === 0 ? (
            <div className="ld-card" style={{ textAlign: 'center', padding: '48px 24px', borderStyle: 'dashed' }}>
              <FileCode2 size={36} style={{ color: '#94a3b8', marginBottom: '10px' }} />
              <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>{t('templates.emptyTitle')}</h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>{t('templates.emptyDesc')}</p>
            </div>
          ) : (
            <div className="ld-card" style={{ padding: 0 }}>
              <div className="ld-table-wrapper" style={{ border: 'none', borderRadius: 'var(--ld-radius)' }}>
                <table className="ld-table">
                  <thead>
                    <tr>
                      <th style={{ width: '32%' }}>{t('templates.colName')}</th>
                      <th style={{ width: '18%' }}>{t('templates.colType')}</th>
                      <th style={{ width: '16%' }}>{t('templates.colStatus')}</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>{t('templates.colVersion')}</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>{t('templates.colSections')}</th>
                      <th style={{ width: '14%', textAlign: 'right' }}>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((tpl) => {
                      let sectionCount = 0;
                      try {
                        const parsed = typeof tpl.sections === 'string' ? JSON.parse(tpl.sections) : tpl.sections;
                        sectionCount = Array.isArray(parsed?.sections) ? parsed.sections.length : 0;
                      } catch {
                        sectionCount = 0;
                      }

                      const statusMeta = getStatusBadge(tpl.status);

                      return (
                        <tr key={tpl.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>{tpl.name}</div>
                            {tpl.description && (
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                {tpl.description}
                              </div>
                            )}
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
                              }}
                            >
                              {tpl.docType}
                            </span>
                          </td>

                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                backgroundColor: statusMeta.bg,
                                color: statusMeta.text,
                                border: `1px solid ${statusMeta.border}`,
                              }}
                            >
                              {statusMeta.label}
                            </span>
                          </td>

                          <td style={{ textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                            v{tpl.currentVersionNo || 1}
                          </td>

                          <td style={{ textAlign: 'center', color: '#64748b' }}>{sectionCount} mục</td>

                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              {isTechLead ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onNavigate && onNavigate('template-edit', { id: tpl.id })}
                                    className="ld-btn ld-btn-ghost"
                                    style={{ padding: '4px 6px' }}
                                    title={t('common.edit')}
                                  >
                                    <Edit size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCloneModalTpl(tpl);
                                      setCloneName(`${tpl.name} (Bản sao)`);
                                    }}
                                    className="ld-btn ld-btn-ghost"
                                    style={{ padding: '4px 6px' }}
                                    title={t('templates.cloneTitle')}
                                  >
                                    <Copy size={14} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onNavigate && onNavigate('template-edit', { id: tpl.id, readOnly: true })}
                                  className="ld-btn ld-btn-ghost"
                                  style={{ padding: '4px 6px' }}
                                  title="Xem cấu trúc"
                                >
                                  <Eye size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Collections Tab */}
      {activeTab === 'collections' && (
        <div className="ld-card" style={{ padding: 0 }}>
          <div className="ld-table-wrapper" style={{ border: 'none', borderRadius: 'var(--ld-radius)' }}>
            <table className="ld-table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>{t('templates.collectionName')}</th>
                  <th style={{ width: '45%' }}>{t('templates.collectionDesc')}</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>{t('templates.colUpdated')}</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((col) => (
                  <tr key={col.id}>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{col.name}</td>
                    <td style={{ color: '#475569' }}>{col.description || '—'}</td>
                    <td style={{ textAlign: 'right', color: '#64748b' }}>{formatDate(col.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clone Modal Dialog */}
      {cloneModalTpl && (
        <div className="ld-modal-overlay">
          <div className="ld-modal" style={{ maxWidth: '480px' }}>
            <form onSubmit={handleCloneSubmit} style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700 }}>
                {t('templates.cloneTitle')}
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#64748b' }}>
                {t('templates.clonePrompt')}
              </p>

              <input
                type="text"
                className="ld-input"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                required
                style={{ marginBottom: '16px' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCloneModalTpl(null)}
                  className="ld-btn ld-btn-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="ld-btn ld-btn-primary">
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
