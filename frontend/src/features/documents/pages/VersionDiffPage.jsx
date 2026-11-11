import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { documentsApi } from '../api';
import DiffViewer from '../../../components/DiffViewer';

export default function VersionDiffPage({
  documentId,
  initialFrom = 1,
  initialTo = 2,
  onNavigate,
}) {
  const { t, lang } = useI18n();

  const [document, setDocument] = useState(null);
  const [versions, setVersions] = useState([]);
  const [fromVer, setFromVer] = useState(initialFrom);
  const [toVer, setToVer] = useState(initialTo);

  const [diffData, setDiffData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load document and versions
  useEffect(() => {
    const initData = async () => {
      try {
        const [doc, vList] = await Promise.all([
          documentsApi.getDocumentById(documentId),
          documentsApi.getDocumentVersions(documentId),
        ]);
        setDocument(doc);
        setVersions(vList);
        if (vList.length >= 2) {
          setFromVer(vList[vList.length - 1]?.versionNo || 1);
          setToVer(doc.currentVersionNo || vList[0]?.versionNo || 2);
        }
      } catch (err) {
        setError('Không thể tải lịch sử phiên bản: ' + err.message);
      }
    };
    initData();
  }, [documentId]);

  const fetchDiff = useCallback(async () => {
    if (!documentId || !fromVer || !toVer) return;
    setLoading(true);
    setError(null);
    try {
      const data = await documentsApi.getDiff(documentId, { from: fromVer, to: toVer });
      setDiffData(data);
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.response?.data?.title || err.message || 'Lỗi khi so sánh hai phiên bản'
      );
    } finally {
      setLoading(false);
    }
  }, [documentId, fromVer, toVer]);

  useEffect(() => {
    if (fromVer && toVer) {
      fetchDiff();
    }
  }, [fetchDiff, fromVer, toVer]);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('document-detail', { id: documentId })}
          className="ld-btn ld-btn-ghost"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
          {t('documents.compareDiff')}: {document?.title}
        </h2>

        <div style={{ width: '80px' }} />
      </div>

      {/* Version Selector Bar */}
      <div
        className="ld-card"
        style={{
          marginBottom: '20px',
          padding: '14px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Từ phiên bản:</span>
            <select
              className="ld-select"
              style={{ width: '130px' }}
              value={fromVer}
              onChange={(e) => setFromVer(Number(e.target.value))}
            >
              {versions.map((v) => (
                <option key={v.versionNo} value={v.versionNo}>
                  v{v.versionNo} ({v.actorRole || 'Actor'})
                </option>
              ))}
            </select>
          </div>

          <span style={{ color: '#94a3b8', fontWeight: 700 }}>→</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Đến phiên bản:</span>
            <select
              className="ld-select"
              style={{ width: '130px' }}
              value={toVer}
              onChange={(e) => setToVer(Number(e.target.value))}
            >
              {versions.map((v) => (
                <option key={v.versionNo} value={v.versionNo}>
                  v{v.versionNo} ({v.actorRole || 'Actor'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchDiff}
          disabled={loading}
          className="ld-btn ld-btn-secondary"
        >
          <RefreshCw size={14} className={loading ? 'ld-spin' : ''} />
          {t('common.retry')}
        </button>
      </div>

      {/* Main Diff Content */}
      {loading ? (
        <div className="ld-card" style={{ padding: '32px' }}>
          <div className="ld-skeleton" style={{ height: '400px' }} />
        </div>
      ) : error ? (
        <div
          className="ld-card"
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: '#fef2f2',
            borderColor: '#fca5a5',
          }}
        >
          <ShieldAlert size={36} style={{ color: '#dc2626', margin: '0 auto 10px' }} />
          <h4 style={{ margin: '0 0 6px', color: '#991b1b', fontSize: '16px', fontWeight: 700 }}>
            Không thể so sánh
          </h4>
          <p style={{ margin: 0, color: '#7f1d1d', fontSize: '13px' }}>{error}</p>
        </div>
      ) : (
        <DiffViewer
          lines={diffData?.diffLines}
          oldText={diffData?.oldText || ''}
          newText={diffData?.newText || ''}
          fromLabel={`Phiên bản #${fromVer}`}
          toLabel={`Phiên bản #${toVer}`}
          mode="split"
          lang={lang}
        />
      )}
    </div>
  );
}
