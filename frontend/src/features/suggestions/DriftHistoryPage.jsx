import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { listDriftAlerts, listSuggestions } from '../../services/workflowApi'
import { normalizeDriftAlert, normalizeSuggestion, uniqueDocuments } from './model'
import { SEVERITIES } from '../../constants/severity'

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

  useEffect(() => {
    let active = true
    listSuggestions().then((items) => { if (active) setDocuments(uniqueDocuments((items || []).map(normalizeSuggestion))) })
      .catch(() => { if (active) setDocuments([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!documentId) { setAlerts([]); return undefined }
    let active = true
    setLoading(true)
    setError('')
    listDriftAlerts(documentId).then((items) => { if (active) setAlerts((items || []).map(normalizeDriftAlert)) })
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

  return <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
    <h1>Lịch sử drift</h1>
    <p>Các lần thay đổi code ảnh hưởng đến entity được liên kết với tài liệu.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '18px 0' }}>
      {!pathDocumentId && <label>Tài liệu<select className="ld-select" value={documentId} onChange={(e) => setFilter('documentId', e.target.value)}><option value="">Chọn tài liệu</option>{documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.title}</option>)}</select></label>}
      <label>Mức độ<select className="ld-select" value={severity} onChange={(e) => setFilter('severity', e.target.value)}><option value="">Tất cả mức</option>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Trạng thái<select className="ld-select" value={handling} onChange={(e) => setFilter('handling', e.target.value)}><option value="">Tất cả trạng thái</option>{[...new Set(alerts.map((item) => item.handlingStatus).filter(Boolean))].map((s) => <option key={s}>{s}</option>)}</select></label>
    </div>
    {!documentId && <p>Chọn tài liệu để xem drift alert.</p>}
    {loading && <p role="status">Đang tải…</p>}
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {!loading && documentId && !error && !filtered.length && <p>Không có drift alert phù hợp.</p>}
    {filtered.map((alert) => <details key={alert.id} className="ld-card" style={{ padding: 16, margin: '10px 0' }}>
      <summary style={{ cursor: 'pointer' }}><strong>{alert.driftType}</strong> · {alert.severity} · {alert.handlingStatus} · {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : ''}</summary>
      <p>Commit: {alert.evidence.commit || '—'} · File: {alert.evidence.file || '—'}</p>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 12, overflowX: 'auto' }}>{JSON.stringify(alert.evidence, null, 2)}</pre>
    </details>)}
  </main>
}
