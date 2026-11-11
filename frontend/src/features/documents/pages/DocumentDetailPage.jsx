import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Edit3,
  Send,
  History,
  Columns,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileCode,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { documentsApi } from '../api';
import DocStatusBadges from '../../../components/DocStatusBadges';
import MarkdownView from '../../../components/MarkdownView';
import EvidencePanel from '../components/EvidencePanel';
import DocCodeLinksPanel from '../components/DocCodeLinksPanel';
import IntegrityCheckPanel from '../components/IntegrityCheckPanel';
import VersionTimeline from '../components/VersionTimeline';
import RollbackModal from '../components/RollbackModal';

export default function DocumentDetailPage({
  documentId,
  onNavigate,
  userRole = 'Developer',
}) {
  const { t, lang } = useI18n();

  const [document, setDocument] = useState(null);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [versions, setVersions] = useState([]);
  const [links, setLinks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active view tab: 'content' | 'history'
  const [activeTab, setActiveTab] = useState('content');
  const [selectedVersionNo, setSelectedVersionNo] = useState(null);

  // Modals & Submissions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState(null);
  const [rollbackTarget, setRollbackTarget] = useState(null);

  const loadDocumentData = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const [docData, versionList, linkList] = await Promise.all([
        documentsApi.getDocumentById(documentId),
        documentsApi.getDocumentVersions(documentId),
        documentsApi.getDocumentLinks(documentId),
      ]);

      setDocument(docData);
      setVersions(versionList);
      setLinks(linkList);

      // Select latest version or currently active version
      const activeVerNo = docData.currentVersionNo || (versionList[0]?.versionNo);
      setSelectedVersionNo(activeVerNo);

      const verDetail = await documentsApi.getDocumentVersion(documentId, activeVerNo);
      setCurrentVersion(verDetail);
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Lỗi khi tải chi tiết tài liệu'
      );
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadDocumentData();
  }, [loadDocumentData]);

  // Switch displayed version
  const handleSelectVersion = async (verNo) => {
    setSelectedVersionNo(verNo);
    try {
      const verDetail = await documentsApi.getDocumentVersion(documentId, verNo);
      setCurrentVersion(verDetail);
      setActiveTab('content');
    } catch (err) {
      alert('Không thể tải phiên bản: ' + (err.message || 'Lỗi'));
    }
  };

  // Submit for review (GEN-10)
  const handleSubmitReview = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn nộp tài liệu này để kiểm duyệt?')) return;
    setIsSubmitting(true);
    try {
      const res = await documentsApi.submitForReview(documentId);
      setSubmitSuccessMsg(res.message || 'Đã nộp duyệt thành công');
      loadDocumentData();
    } catch (err) {
      alert('Lỗi nộp duyệt: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
        <div className="ld-skeleton" style={{ width: '140px', height: '32px', marginBottom: '16px' }} />
        <div className="ld-skeleton" style={{ width: '60%', height: '28px', marginBottom: '8px' }} />
        <div className="ld-skeleton" style={{ width: '30%', height: '18px', marginBottom: '24px' }} />
        <div className="ld-two-columns">
          <div className="ld-skeleton" style={{ height: '400px' }} />
          <div className="ld-skeleton" style={{ height: '300px' }} />
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 16px' }}>
        <div
          className="ld-card"
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            backgroundColor: '#fef2f2',
            borderColor: '#fca5a5',
          }}
        >
          <AlertTriangle size={36} style={{ color: '#dc2626', marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px', color: '#991b1b' }}>{error || 'Không tìm thấy tài liệu'}</h3>
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('document-list')}
            className="ld-btn ld-btn-secondary"
            style={{ marginTop: '16px' }}
          >
            <ArrowLeft size={14} />
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const isDraftOrChanges = document.docStatus === 'DRAFT' || document.docStatus === 'CHANGES_REQUESTED';
  const canEdit = userRole === 'Developer' && isDraftOrChanges;
  const canSubmit = userRole === 'Developer' && isDraftOrChanges;
  const canRollback = ['Developer', 'Manager', 'Technical Lead', 'TechLead'].includes(userRole);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Navigation & Back */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('document-list')}
          className="ld-btn ld-btn-ghost"
          style={{ padding: '6px 10px' }}
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Compare Diff Button */}
          {versions.length > 1 && (
            <button
              type="button"
              onClick={() =>
                onNavigate &&
                onNavigate('document-diff', {
                  documentId,
                  from: versions[1]?.versionNo || 1,
                  to: document.currentVersionNo || versions[0]?.versionNo || 2,
                })
              }
              className="ld-btn ld-btn-secondary"
            >
              <Columns size={14} />
              {t('documents.compareDiff')}
            </button>
          )}

          {/* Edit Draft Button */}
          {canEdit && (
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('document-edit', { id: document.id })}
              className="ld-btn ld-btn-secondary"
            >
              <Edit3 size={14} />
              {t('documents.editDraft')}
            </button>
          )}

          {/* Submit for review button */}
          {canSubmit && (
            <button
              type="button"
              onClick={handleSubmitReview}
              disabled={isSubmitting}
              className="ld-btn ld-btn-primary"
            >
              <Send size={14} />
              {isSubmitting ? t('common.loading') : t('documents.submitReview')}
            </button>
          )}
        </div>
      </div>

      {/* Success banner if just submitted */}
      {submitSuccessMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '6px',
            color: '#166534',
            marginBottom: '16px',
            fontSize: '13px',
          }}
        >
          <CheckCircle2 size={18} />
          {submitSuccessMsg}
        </div>
      )}

      {/* Document Header Card */}
      <div className="ld-card" style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                }}
              >
                {document.docType}
              </span>
              <span style={{ fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>
                {document.pathInRepo || document.path}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
              {document.title}
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            {/* 3 Independent Badges (WF-24) */}
            <DocStatusBadges
              docStatus={document.docStatus}
              publishStatus={document.publishStatus}
              prStatus={document.prStatus}
              size="md"
              lang={lang}
            />

            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Đang xem: <strong>Phiên bản #{selectedVersionNo}</strong> (Hiện tại: #{document.currentVersionNo})
            </span>
          </div>
        </div>

        {/* View mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '8px', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'content' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'content' ? '#2563eb' : '#64748b',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileCode size={15} />
            Nội dung tài liệu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'history' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'history' ? '#2563eb' : '#64748b',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <History size={15} />
            {t('documents.history')} ({versions.length})
          </button>
        </div>
      </div>

      {/* Main Content: Two Columns */}
      <div className="ld-two-columns">
        {/* Left Column (Wide) */}
        <div>
          {activeTab === 'history' ? (
            <VersionTimeline
              versions={versions}
              selectedVersionNo={selectedVersionNo}
              onSelectVersion={handleSelectVersion}
              onCompareDiff={(vNo) =>
                onNavigate &&
                onNavigate('document-diff', {
                  documentId,
                  from: vNo,
                  to: document.currentVersionNo,
                })
              }
              onOpenRollback={(ver) => setRollbackTarget(ver)}
              canRollback={canRollback}
            />
          ) : (
            <div className="ld-card" style={{ padding: '24px' }}>
              {currentVersion?.contentRedacted ? (
                /* Redacted Content Warning (No blank box) */
                <div
                  style={{
                    padding: '32px 20px',
                    textAlign: 'center',
                    backgroundColor: '#fef2f2',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                  }}
                >
                  <ShieldAlert size={36} style={{ color: '#dc2626', marginBottom: '8px' }} />
                  <h4 style={{ margin: '0 0 6px', color: '#991b1b', fontSize: '15px', fontWeight: 600 }}>
                    {t('documents.redactedNotice')}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#7f1d1d' }}>
                    {currentVersion.reason || 'Nội dung chứa dữ liệu nhạy cảm đã bị che vĩnh viễn theo chính sách bảo mật.'}
                  </p>
                </div>
              ) : (
                <MarkdownView content={currentVersion?.content || ''} />
              )}
            </div>
          )}
        </div>

        {/* Right Column (Narrow Sidecar) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* AI Confidence & Grounding Evidence Panel */}
          <EvidencePanel generation={currentVersion?.generation} />

          {/* SHA-256 Hash Integrity Panel (VER-08) */}
          <IntegrityCheckPanel documentId={documentId} />

          {/* Code & VCS Links */}
          <DocCodeLinksPanel links={links} />
        </div>
      </div>

      {/* Rollback Modal */}
      <RollbackModal
        isOpen={Boolean(rollbackTarget)}
        onClose={() => setRollbackTarget(null)}
        documentId={documentId}
        targetVersion={rollbackTarget}
        onRollbackSuccess={() => {
          setRollbackTarget(null);
          loadDocumentData();
        }}
      />
    </div>
  );
}
