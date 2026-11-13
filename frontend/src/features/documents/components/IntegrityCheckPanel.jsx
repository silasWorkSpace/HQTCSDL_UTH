import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { documentsApi } from '../api';

function getProblemDescription(code, t) {
  switch (code) {
    case 'HASH_MISMATCH':
      return t('documents.integrityProblemHash');
    case 'BROKEN_LINK':
      return t('documents.integrityProblemLink');
    case 'VERSION_GAP':
      return t('documents.integrityProblemGap');
    default:
      return code || 'Không xác định';
  }
}

export default function IntegrityCheckPanel({ documentId, className = '' }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [integrity, setIntegrity] = useState(null);
  const [error, setError] = useState(null);

  const fetchIntegrity = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await documentsApi.verifyIntegrity(documentId);
      setIntegrity(data);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Lỗi kiểm tra toàn vẹn');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchIntegrity();
  }, [fetchIntegrity]);

  return (
    <div className={`ld-card ${className}`} style={{ padding: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {integrity?.isValid ? (
            <ShieldCheck size={18} style={{ color: '#16a34a' }} />
          ) : (
            <ShieldAlert size={18} style={{ color: '#dc2626' }} />
          )}
          {t('documents.integrityCheck')}
        </h4>
        <button
          type="button"
          onClick={fetchIntegrity}
          disabled={loading}
          className="ld-btn ld-btn-ghost"
          style={{ padding: '4px 8px', fontSize: '12px' }}
          title={t('common.retry')}
        >
          <RefreshCw size={13} className={loading ? 'ld-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div style={{ padding: '12px', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
          {t('common.loading')}
        </div>
      )}

      {error && (
        <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {!loading && integrity && (
        <div>
          {integrity.isValid ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                color: '#166534',
              }}
            >
              <ShieldCheck size={20} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{t('documents.integrityValidTitle')}</div>
                <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                  {t('documents.integrityValidDesc')}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#991b1b',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                <ShieldAlert size={18} />
                {t('documents.integrityBrokenTitle')}
              </div>
              <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                {t('documents.integrityBrokenDesc')}
              </div>

              {integrity.problems && integrity.problems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {integrity.problems.map((prob, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #fca5a5',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#7f1d1d',
                      }}
                    >
                      <strong>Phiên bản #{prob.versionNo}:</strong> {getProblemDescription(prob.problem, t)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
