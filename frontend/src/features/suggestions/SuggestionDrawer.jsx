import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { acceptSuggestion, dismissSuggestion, editSuggestion, fetchPublishedContent, listDriftAlerts } from '../../services/workflowApi'
import { normalizeDriftAlert } from './model'

export default function SuggestionDrawer({ suggestion, onClose, onDone = onClose }) {
  const [alerts, setAlerts] = useState([])
  const [publishedContent, setPublishedContent] = useState(null)
  const [content, setContent] = useState('')
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!suggestion) return
    let active = true
    setContent(suggestion.content || '')
    setReason('')
    setEditing(false)
    setError('')
    Promise.all([
      listDriftAlerts(suggestion.documentId).catch(() => []),
      fetchPublishedContent(suggestion.documentId).catch(() => null),
    ]).then(([items, published]) => {
      if (!active) return
      setAlerts((items || []).map(normalizeDriftAlert))
      setPublishedContent(published)
    })
    return () => { active = false }
  }, [suggestion])

  if (!suggestion) return null
  const alert = alerts.find((item) => item.id === suggestion.driftAlertId)
  const run = async (action) => {
    setLoading(true)
    setError('')
    try {
      if (action === 'accept') await acceptSuggestion(suggestion.id)
      if (action === 'edit') await editSuggestion(suggestion.id, content)
      if (action === 'dismiss') {
        if (!reason.trim()) throw new Error('Cần nhập lý do dismiss.')
        await dismissSuggestion(suggestion.id, reason.trim())
      }
      onDone?.()
    } catch (e) {
      setError(e?.detail || e?.message || 'Không xử lý được gợi ý.')
    } finally { setLoading(false) }
  }

  const pending = suggestion.status === 'Pending Developer Action'
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#0f172a66', display: 'flex', justifyContent: 'flex-end' }}>
      <aside role="dialog" aria-modal="true" aria-label={`Gợi ý ${suggestion.documentTitle}`} onClick={(event) => event.stopPropagation()}
        style={{ background: 'white', width: 'min(720px, 100vw)', height: '100%', overflow: 'auto', padding: 24, boxShadow: '-8px 0 24px #0f172a22' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div><h2 style={{ marginTop: 0 }}>{suggestion.documentTitle || 'Gợi ý drift'}</h2><span>{suggestion.status} · {alert?.driftType || suggestion.origin} · {alert?.severity || suggestion.topSeverity || '—'}</span></div>
          <button type="button" className="ld-btn ld-btn-ghost" onClick={onClose}>Đóng</button>
        </header>
        {pending && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '18px 0' }}>
          {!editing && <button className="ld-btn ld-btn-primary" disabled={loading} onClick={() => run('accept')}>Chấp nhận và gửi duyệt</button>}
          {!editing && <button className="ld-btn ld-btn-secondary" disabled={loading} onClick={() => setEditing(true)}>Sửa đề xuất</button>}
          {editing && <><button className="ld-btn ld-btn-primary" disabled={loading || !content.trim()} onClick={() => run('edit')}>Lưu và gửi duyệt</button><button className="ld-btn ld-btn-secondary" onClick={() => { setEditing(false); setContent(suggestion.content) }}>Hủy sửa</button></>}
        </div>}
        {pending && <section style={{ marginBottom: 18 }}><label className="ld-label">Lý do bỏ qua gợi ý<textarea className="ld-input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập lý do rồi bấm Bỏ qua" /></label><button className="ld-btn ld-btn-secondary" disabled={loading || !reason.trim()} onClick={() => run('dismiss')}>Bỏ qua gợi ý</button></section>}
        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
        <section><h3>Nội dung đề xuất</h3>{editing ? <textarea className="ld-input" rows={14} value={content} onChange={(e) => setContent(e.target.value)} /> : <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{suggestion.content}</pre>}</section>
        <section><h3>Bằng chứng nguồn code</h3><dl>
          <dt>Commit</dt><dd>{suggestion.evidence.commit || '—'}</dd>
          <dt>File</dt><dd>{suggestion.evidence.file || '—'}</dd>
          <dt>Drift</dt><dd>{alert?.driftType || '—'} / {alert?.handlingStatus || '—'}</dd>
        </dl><pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 12, overflowX: 'auto' }}>{JSON.stringify({ entities: suggestion.evidence.entities, diff: suggestion.evidence.diff }, null, 2)}</pre></section>
        <section><h3>So sánh nội dung</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div><strong>Bản đã publish</strong><pre style={{ whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto' }}>{publishedContent || 'Chưa có bản published.'}</pre></div><div><strong>Đề xuất</strong><pre style={{ whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto' }}>{editing ? content : suggestion.content}</pre></div></div></section>
        <Link to={`/drift-history?documentId=${suggestion.documentId}`} onClick={onClose}>Mở lịch sử drift của tài liệu</Link>
      </aside>
    </div>
  )
}
