import { useEffect, useMemo, useState } from 'react'
import SuggestionDrawer from './SuggestionDrawer'
import { listSuggestions } from '../../services/workflowApi'
import { ALL_STATUSES, SUGGESTION_STATUS } from './constants'
import { normalizeSuggestion, sortSuggestions } from './model'

export default function SuggestionQueuePage() {
  const [status, setStatus] = useState(SUGGESTION_STATUS.PENDING)
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    listSuggestions(status === ALL_STATUSES ? undefined : status)
      .then((items) => { if (active) setRows(sortSuggestions((items || []).map(normalizeSuggestion))) })
      .catch((e) => { if (active) setError(e?.detail || e?.message || 'Không tải được gợi ý drift.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [status, refresh])

  const selectedRow = useMemo(() => rows.find((row) => row.id === selected) ?? null, [rows, selected])
  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <h1>Gợi ý cập nhật từ drift</h1>
      <p>Chỉ các thay đổi code đã liên kết với tài liệu mới xuất hiện tại đây.</p>
      <label style={{ display: 'grid', gap: 6, maxWidth: 340, margin: '16px 0' }}>Trạng thái
        <select className="ld-select" value={status} onChange={(event) => setStatus(event.target.value)}>
          {[SUGGESTION_STATUS.PENDING, SUGGESTION_STATUS.ACCEPTED, SUGGESTION_STATUS.DISMISSED,
            SUGGESTION_STATUS.SUPERSEDED, ALL_STATUSES].map((item) => <option key={item} value={item}>{item === ALL_STATUSES ? 'Tất cả' : item}</option>)}
        </select>
      </label>
      {loading && <p role="status">Đang tải…</p>}
      {error && <div role="alert" style={{ color: '#b91c1c' }}>{error} <button onClick={() => setRefresh((n) => n + 1)}>Thử lại</button></div>}
      {!loading && !error && !rows.length && <p>Chưa có gợi ý ở trạng thái này.</p>}
      {!loading && rows.map((row) => (
        <button key={row.id} type="button" onClick={() => setSelected(row.id)} className="ld-card"
          style={{ display: 'block', width: '100%', textAlign: 'left', margin: '10px 0', padding: 16, cursor: 'pointer' }}>
          <strong>{row.documentTitle || row.documentId}</strong>
          <span style={{ float: 'right' }}>{row.status}</span>
          <div style={{ marginTop: 8, color: '#475569' }}>{row.topSeverity || 'Severity pending'} · {row.origin} · {row.confidence == null ? '—' : `${Math.round(row.confidence * 100)}% confidence`}</div>
          <div style={{ marginTop: 8 }}>{row.content.slice(0, 220)}{row.content.length > 220 ? '…' : ''}</div>
        </button>
      ))}
      <SuggestionDrawer suggestion={selectedRow} onClose={() => setSelected(null)} onDone={() => { setSelected(null); setRefresh((n) => n + 1) }} />
    </main>
  )
}
