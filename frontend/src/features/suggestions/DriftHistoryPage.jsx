import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, FileCode, GitCommit, ShieldAlert, Layers } from 'lucide-react'
import { listDriftAlerts } from '../../services/workflowApi'
import { documentsApi } from '../documents/api'
import { normalizeDriftAlert } from './model'
import { SEVERITIES } from '../../constants/severity'
import SeverityBadge from '../../components/SeverityBadge'

export default function DriftHistoryPage() {
  const { id: pathDocumentId } = useParams()
  const [params, setParams] = useSearchParams()
  const documentId = pathDocumentId || params.get('documentId') || ''
  const [documents, setDocuments] = useState([])
  const [alerts, setAlerts] = useState([])
  const [severity, setSeverity] = useState(params.get('severity') || '')
  const [handling, setHandling] = useState(params.get('handling') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load list of all documents from workspace so user can select any document
  useEffect(() => {
    let active = true
    documentsApi.getDocuments({ size: 100 })
      .then((res) => {
        if (!active) return
        const docs = (res?.items || []).map((d) => ({ id: d.id, title: d.title || d.id }))
        setDocuments(docs)
      })
      .catch(() => {
        if (active) setDocuments([])
      })
    return () => { active = false }
  }, [])

  // Load drift alerts (all or for the chosen document)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    listDriftAlerts(documentId || undefined)
      .then((items) => { if (active) setAlerts((items || []).map(normalizeDriftAlert)) })
      .catch((e) => { if (active) setError(e?.detail || e?.message || 'Không tải được lịch sử drift.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [documentId])

  const filtered = useMemo(() => alerts.filter((item) => (!severity || item.severity === severity) && (!handling || item.handlingStatus === handling)), [alerts, severity, handling])

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next)
    if (key === 'severity') setSeverity(value)
    if (key === 'handling') setHandling(value)
  }

  const selectedDocTitle = documents.find((d) => d.id === documentId)?.title || documentId

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        {pathDocumentId && (
          <Link to={`/documents/${pathDocumentId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '13px', color: '#2563eb', marginBottom: 12, textDecoration: 'none' }}>
            <ArrowLeft size={16} /> Quay lại chi tiết tài liệu
          </Link>
        )}
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
          Lịch sử drift tài liệu
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Theo dõi các lần thay đổi mã nguồn ảnh hưởng đến các thực thể code được liên kết với tài liệu kỹ thuật.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="ld-card" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        {!pathDocumentId && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Tài liệu kỹ thuật:</span>
            <select
              className="ld-select"
              value={documentId}
              onChange={(e) => setFilter('documentId', e.target.value)}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              <option value="">Tất cả tài liệu ({documents.length})</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title}</option>
              ))}
            </select>
          </label>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Mức độ (Severity):</span>
          <select
            className="ld-select"
            value={severity}
            onChange={(e) => setFilter('severity', e.target.value)}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            <option value="">Tất cả mức độ</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Trạng thái xử lý:</span>
          <select
            className="ld-select"
            value={handling}
            onChange={(e) => setFilter('handling', e.target.value)}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            <option value="">Tất cả trạng thái</option>
            {[...new Set(alerts.map((item) => item.handlingStatus).filter(Boolean))].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: '13px', color: '#64748b' }}>
          {documentId ? (
            <>Đang lọc: <strong>{selectedDocTitle}</strong> ({filtered.length} cảnh báo)</>
          ) : (
            <>Hiển thị: <strong>Tất cả tài liệu</strong> ({filtered.length} cảnh báo)</>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
          Đang tải lịch sử drift...
        </div>
      )}

      {error && (
        <div style={{ padding: 16, backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, color: '#b91c1c', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="ld-card" style={{ padding: '40px 24px', textAlign: 'center', color: '#64748b' }}>
          <ShieldAlert size={36} style={{ color: '#16a34a', marginBottom: 12 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#166534', margin: '0 0 6px 0' }}>
            Không có cảnh báo drift nào
          </h3>
          <p style={{ fontSize: '13px', margin: 0 }}>
            {documentId
              ? 'Tài liệu này hiện hoàn toàn đồng bộ với mã nguồn và chưa phát hiện thay đổi bất thường nào.'
              : 'Hiện tại hệ thống không phát hiện bất kỳ cảnh báo drift nào trên các tài liệu kỹ thuật.'}
          </p>
        </div>
      )}

      {!loading && filtered.map((alert) => (
        <div key={alert.id} className="ld-card" style={{ padding: 20, marginBottom: 16, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: 4, backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                {alert.driftType}
              </span>
              <SeverityBadge severity={alert.severity} compact />
              <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: 4, backgroundColor: alert.handlingStatus === 'Open' ? '#fef3c7' : '#dcfce7', color: alert.handlingStatus === 'Open' ? '#92400e' : '#166534', fontWeight: 600 }}>
                {alert.handlingStatus || 'Open'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#64748b' }}>
              <Clock size={13} />
              <span>{alert.createdAt ? new Date(alert.createdAt).toLocaleString('vi-VN') : '—'}</span>
            </div>
          </div>

          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px' }}>
            <span style={{ color: '#64748b', fontWeight: 500 }}>Tài liệu:</span>
            <Link
              to={`/documents/${alert.documentId}`}
              style={{ fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
            >
              {alert.documentTitle || documents.find((d) => d.id === alert.documentId)?.title || alert.documentId}
            </Link>
          </div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: '13px', color: '#475569', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitCommit size={15} style={{ color: '#64748b' }} />
              <span>Commit: <code style={{ backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: 4 }}>{(alert.evidence?.commit || '').slice(0, 10) || '—'}</code></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileCode size={15} style={{ color: '#64748b' }} />
              <span>File: <code style={{ backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: 4 }}>{alert.evidence?.file || '—'}</code></span>
            </div>
          </div>

          {/* Evidence Entities details */}
          {(alert.evidence?.entities || []).length > 0 && (
            <div style={{ marginTop: 10, marginBottom: 10 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Thực thể mã nguồn liên quan:</span>
              <ul style={{ margin: '6px 0 0 20px', padding: 0, fontSize: '13px', color: '#475569' }}>
                {(alert.evidence?.entities || []).map((ent, idx) => (
                  <li key={idx} style={{ marginBottom: 4 }}>
                    <strong>{ent.entity}</strong> ({ent.kind || 'class'}): {ent.message || 'Thay đổi định nghĩa thực thể'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#2563eb' }}>
              Xem chi tiết JSON bằng chứng (Evidence Payload)
            </summary>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: '12px', border: '1px solid #e2e8f0', marginTop: 8, overflowX: 'auto' }}>
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  )
}
