import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Save,
  Eye,
  Edit,
  AlertTriangle,
  RotateCw,
  Copy,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { documentsApi } from '../api';
import MarkdownView from '../../../components/MarkdownView';
import DocStatusBadges from '../../../components/DocStatusBadges';

export default function DraftEditorPage({
  documentId,
  onNavigate,
  userRole = 'Developer',
}) {
  const { t, lang } = useI18n();

  const [document, setDocument] = useState(null);
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [baseVersionNo, setBaseVersionNo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 409 Conflict Modal State
  const [conflictData, setConflictData] = useState(null);

  // Responsive tab state for narrow screens: 'edit' | 'preview'
  const [activeTab, setActiveTab] = useState('edit');

  const hasUnsavedChanges = content !== savedContent;

  const loadDraft = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const doc = await documentsApi.getDocumentById(documentId);
      setDocument(doc);
      setBaseVersionNo(doc.currentVersionNo);

      const ver = await documentsApi.getDocumentVersion(documentId, doc.currentVersionNo);
      const text = ver.content || '';
      setContent(text);
      setSavedContent(text);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Không thể tải bản nháp');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // Unsaved changes warning before unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const updatedVer = await documentsApi.updateDraft(documentId, {
        content,
        baseVersionNo,
      });

      setSavedContent(content);
      setBaseVersionNo(updatedVer.versionNo);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      if (err?.response?.status === 409) {
        setConflictData({
          message: err.response.data?.detail || 'Bản nháp đã thay đổi ở một phiên làm việc khác.',
        });
      } else {
        setError(err?.response?.data?.detail || err.message || 'Lỗi khi lưu bản nháp');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSafeNavigate = (target, params) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(t('documents.unsavedWarning'));
      if (!confirmed) return;
    }
    if (onNavigate) onNavigate(target, params);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
        <div className="ld-skeleton" style={{ width: '200px', height: '32px', marginBottom: '16px' }} />
        <div className="ld-skeleton" style={{ height: '500px' }} />
      </div>
    );
  }

  const isEditableStatus =
    document && (document.docStatus === 'DRAFT' || document.docStatus === 'CHANGES_REQUESTED');
  const isAuthorized = userRole === 'Developer';
  const isReadOnly = !isEditableStatus || !isAuthorized;

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px 16px' }}>
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => handleSafeNavigate('document-detail', { id: documentId })}
            className="ld-btn ld-btn-ghost"
            style={{ padding: '6px 10px' }}
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              {t('documents.editorTitle')}: {document?.title}
            </h2>
            <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
              {document?.pathInRepo || document?.path} (v{baseVersionNo})
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {document && (
            <DocStatusBadges
              docStatus={document.docStatus}
              publishStatus={document.publishStatus}
              prStatus={document.prStatus}
              size="sm"
              lang={lang}
            />
          )}

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              className="ld-btn ld-btn-primary"
              style={{ padding: '8px 18px' }}
            >
              <Save size={14} />
              {saving ? t('common.saving') : t('common.save')}
            </button>
          )}
        </div>
      </div>

      {/* Read-only notification banner */}
      {isReadOnly && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            color: '#92400e',
            fontSize: '13px',
            marginBottom: '14px',
          }}
        >
          <Lock size={16} />
          {t('documents.readOnlyReason')}
        </div>
      )}

      {/* Save Success Banner */}
      {saveSuccess && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '6px',
            color: '#166534',
            fontSize: '13px',
            marginBottom: '14px',
          }}
        >
          <CheckCircle2 size={16} />
          Đã lưu thành công phiên bản mới!
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '13px',
            marginBottom: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Responsive Tab Switcher for tablet/narrow screens */}
      <div
        className="ld-editor-tabs-mobile"
        style={{
          display: 'none',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('edit')}
          className={`ld-btn ${activeTab === 'edit' ? 'ld-btn-primary' : 'ld-btn-secondary'}`}
        >
          <Edit size={14} />
          {t('documents.editorMarkdownTab')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`ld-btn ${activeTab === 'preview' ? 'ld-btn-primary' : 'ld-btn-secondary'}`}
        >
          <Eye size={14} />
          {t('documents.editorPreviewTab')}
        </button>
      </div>

      {/* Two Column Layout: Editor (Left) & Live Preview (Right) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          height: 'calc(100vh - 220px)',
          minHeight: '500px',
        }}
      >
        {/* LEFT COLUMN: Markdown Textarea */}
        <div
          className="ld-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            height: '100%',
          }}
        >
          <div
            style={{
              padding: '6px 8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#64748b',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{t('documents.editorMarkdownTab')}</span>
            {hasUnsavedChanges && (
              <span style={{ color: '#ea580c', fontWeight: 600 }}>• Chưa lưu thay đổi</span>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isReadOnly}
            style={{
              flex: 1,
              width: '100%',
              resize: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '14px',
              lineHeight: 1.6,
              color: '#0f172a',
              backgroundColor: isReadOnly ? '#f8fafc' : '#ffffff',
            }}
            placeholder="Nhập nội dung markdown ở đây..."
          />
        </div>

        {/* RIGHT COLUMN: Live MarkdownView */}
        <div
          className="ld-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '12px',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: '6px 8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#64748b',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '8px',
            }}
          >
            {t('documents.editorPreviewTab')}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            <MarkdownView content={content} />
          </div>
        </div>
      </div>

      {/* 409 Conflict Dialog Modal */}
      {conflictData && (
        <div className="ld-modal-overlay">
          <div className="ld-modal" style={{ maxWidth: '500px' }}>
            <div style={{ padding: '20px' }}>
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
                <AlertTriangle size={26} />
              </div>

              <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: '17px', fontWeight: 700 }}>
                {t('documents.conflictTitle')}
              </h3>
              <p style={{ margin: '0 0 16px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                {conflictData.message || t('documents.conflictDesc')}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Option 1: Reload */}
                <button
                  type="button"
                  onClick={() => {
                    setConflictData(null);
                    loadDraft();
                  }}
                  className="ld-btn ld-btn-danger"
                  style={{ width: '100%', padding: '10px' }}
                >
                  <RotateCw size={14} />
                  {t('documents.conflictReload')}
                </button>

                {/* Option 2: Keep to copy */}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(content);
                    setConflictData(null);
                    alert('Đã sao chép nội dung đang soạn vào bộ nhớ tạm.');
                  }}
                  className="ld-btn ld-btn-secondary"
                  style={{ width: '100%', padding: '10px' }}
                >
                  <Copy size={14} />
                  {t('documents.conflictKeep')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
