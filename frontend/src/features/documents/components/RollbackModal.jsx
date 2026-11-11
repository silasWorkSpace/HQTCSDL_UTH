import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { documentsApi } from '../api';

export default function RollbackModal({
  isOpen,
  onClose,
  documentId,
  targetVersion,
  onRollbackSuccess,
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!isOpen || !targetVersion) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do thực hiện rollback');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await documentsApi.rollbackDocument(documentId, {
        targetVersionNo: targetVersion.versionNo,
        reason: reason.trim(),
      });
      setResult(data);
      if (onRollbackSuccess) onRollbackSuccess(data);
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Lỗi khi thực hiện rollback'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setError(null);
    setResult(null);
    onClose();
  };

  return (
    <div className="ld-modal-overlay">
      <div className="ld-modal" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw size={18} style={{ color: '#2563eb' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
              {t('documents.rollbackTitle')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="ld-btn ld-btn-ghost"
            style={{ padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {result ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#dcfce7',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                }}
              >
                <CheckCircle2 size={28} />
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
                {t('common.success')}
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#475569' }}>
                Đã tạo thành công phiên bản mới <strong>#{result.versionNo || result.newVersionNo}</strong> từ phiên bản #{targetVersion.versionNo}.
              </p>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: result.requiresReview ? '#fef9c3' : '#eff6ff',
                  color: result.requiresReview ? '#854d0e' : '#1e40af',
                  borderRadius: '6px',
                  fontSize: '12px',
                  border: `1px solid ${result.requiresReview ? '#fde047' : '#bfdbfe'}`,
                  marginBottom: '20px',
                }}
              >
                {result.requiresReview
                  ? t('documents.rollbackRequiresReview')
                  : t('documents.rollbackImmediate')}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="ld-btn ld-btn-primary"
                style={{ width: '100%' }}
              >
                {t('common.close')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Plain explanation box */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 14px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#1e40af',
                  lineHeight: 1.5,
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>{t('documents.rollbackExplanation')}</div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <span className="ld-label">{t('documents.rollbackTarget')}</span>
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Phiên bản #{targetVersion.versionNo}
                  {targetVersion.statusAtVersion && ` (${targetVersion.statusAtVersion})`}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="rollbackReason" className="ld-label">
                  {t('documents.rollbackReasonLabel')}
                </label>
                <textarea
                  id="rollbackReason"
                  rows={3}
                  className="ld-textarea"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('documents.rollbackReasonPlaceholder')}
                  required
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: '10px',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    borderRadius: '6px',
                    fontSize: '12px',
                    marginBottom: '16px',
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  className="ld-btn ld-btn-secondary"
                  disabled={loading}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="ld-btn ld-btn-primary"
                  disabled={loading || !reason.trim()}
                >
                  {loading ? t('common.loading') : t('common.confirm')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
