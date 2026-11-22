import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, Check, CheckCircle2, Clock, ExternalLink, FileCode, GitCommit, ShieldAlert, X } from 'lucide-react'
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
        if (!reason.trim()) throw new Error('Cần nhập lý do bỏ qua gợi ý.')
        await dismissSuggestion(suggestion.id, reason.trim())
      }
      onDone?.()
    } catch (e) {
      setError(e?.detail || e?.message || 'Không xử lý được gợi ý.')
    } finally { setLoading(false) }
  }

  const pending = suggestion.status === 'Pending Developer Action'
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(15, 23, 42, 0.45)', display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(2px)' }}>
      <aside role="dialog" aria-modal="true" aria-label={`Gợi ý ${suggestion.documentTitle}`} onClick={(event) => event.stopPropagation()}
        style={{ background: 'white', width: 'min(760px, 100vw)', height: '100%', overflow: 'auto', padding: 28, boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.15)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{suggestion.documentTitle || 'Gợi ý drift'}</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: '13px', color: '#64748b' }}>
              <span style={{ fontWeight: 600, color: pending ? '#92400e' : '#166534' }}>{suggestion.status}</span>
              <span>·</span>
              <span>Loại: {alert?.driftType || suggestion.origin}</span>
              <span>·</span>
              <span>Mức: {alert?.severity || suggestion.topSeverity || '—'}</span>
            </div>
          </div>
          <button type="button" className="ld-btn ld-btn-ghost" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </header>

        {/* Action Toolbar for Pending items */}
        {pending && (
          <div style={{ margin: '20px 0', padding: '16px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: 10 }}>Hành động xử lý gợi ý:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {!editing && (
                <button className="ld-btn ld-btn-primary" disabled={loading} onClick={() => run('accept')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} /> Chấp nhận và gửi duyệt
                </button>
              )}
              {!editing && (
                <button className="ld-btn ld-btn-secondary" disabled={loading} onClick={() => setEditing(true)}>
                  Chỉnh sửa đề xuất
                </button>
              )}
              {editing && (
                <>
                  <button className="ld-btn ld-btn-primary" disabled={loading || !content.trim()} onClick={() => run('edit')}>
                    Lưu thay đổi & Gửi duyệt
                  </button>
                  <button className="ld-btn ld-btn-secondary" onClick={() => { setEditing(false); setContent(suggestion.content) }}>
                    Hủy chỉnh sửa
                  </button>
                </>
              )}
            </div>

            {/* Dismiss section */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                Hoặc bỏ qua gợi ý này (Cần nêu rõ lý do):
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="ld-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ví dụ: Tài liệu này đã phản ánh đúng ngữ cảnh kinh doanh..."
                  style={{ flex: 1, fontSize: '13px' }}
                />
                <button className="ld-btn ld-btn-secondary" disabled={loading || !reason.trim()} onClick={() => run('dismiss')}>
                  Bỏ qua
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: 12, backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 6, color: '#b91c1c', marginBottom: 16, fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Suggested Content */}
        <section style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Nội dung đề xuất cập nhật</h3>
          {editing ? (
            <textarea className="ld-input" rows={12} value={content} onChange={(e) => setContent(e.target.value)} style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }} />
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f8fafc', padding: 16, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '13px', lineHeight: 1.6 }}>
              {suggestion.content}
            </div>
          )}
        </section>

        {/* Source Evidence */}
        <section style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Bằng chứng nguồn mã nguồn (Grounding)</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '12px', color: '#475569', marginBottom: 10 }}>
            <div>Commit: <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{(suggestion?.evidence?.commit || '').slice(0, 10) || '—'}</code></div>
            <div>Tệp: <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{suggestion?.evidence?.file || '—'}</code></div>
            <div>Trạng thái: <strong style={{ color: '#0f172a' }}>{alert?.driftType || '—'} ({alert?.handlingStatus || '—'})</strong></div>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '12px', overflowX: 'auto', maxHeight: 200 }}>
            {JSON.stringify({ entities: suggestion?.evidence?.entities || [], diff: suggestion?.evidence?.diff || '' }, null, 2)}
          </pre>
        </section>

        {/* Comparison */}
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>So sánh với nội dung tài liệu hiện hành</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Bản hiện hành (Published)</div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '12px', maxHeight: 220, overflow: 'auto' }}>
                {publishedContent || 'Chưa có bản published trước đó.'}
              </pre>
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb', marginBottom: 4 }}>Đề xuất mới (AI Generated)</div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#eff6ff', padding: 12, borderRadius: 6, border: '1px solid #bfdbfe', fontSize: '12px', maxHeight: 220, overflow: 'auto' }}>
                {editing ? content : suggestion.content}
              </pre>
            </div>
          </div>
        </section>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          <Link
            to={`/drift-history?documentId=${suggestion.documentId}`}
            onClick={onClose}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '13px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
          >
            Mở xem toàn bộ lịch sử drift của tài liệu này <ArrowRight size={14} />
          </Link>
        </div>
      </aside>
    </div>
  )
}
