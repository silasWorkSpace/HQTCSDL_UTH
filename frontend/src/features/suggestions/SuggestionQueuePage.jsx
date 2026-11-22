import { useEffect, useMemo, useState } from 'react'
import { Sparkles, RefreshCw, FileText, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import SuggestionDrawer from './SuggestionDrawer'
import { listSuggestions } from '../../services/workflowApi'
import { ALL_STATUSES, SUGGESTION_STATUS } from './constants'
import { normalizeSuggestion, sortSuggestions } from './model'
import SeverityBadge from '../../components/SeverityBadge'

export default function SuggestionQueuePage() {
  const [status, setStatus] = useState(ALL_STATUSES)
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

  const statusConfig = {
    'Pending Developer Action': { label: 'Chờ Developer xử lý', bg: '#fef3c7', text: '#92400e' },
    'Accepted': { label: 'Đã chấp nhận', bg: '#dcfce7', text: '#166534' },
    'Dismissed': { label: 'Đã bỏ qua', bg: '#f1f5f9', text: '#475569' },
    'Superseded': { label: 'Bị thay thế', bg: '#f1f5f9', text: '#94a3b8' },
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ display: 'inline-flex', padding: '4px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Sparkles size={18} />
            </span>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Gợi ý cập nhật từ drift (AI Suggestions)
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Hệ thống AI tự động phân tích các thay đổi mã nguồn và sinh đề xuất cập nhật tài liệu kỹ thuật tương ứng.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefresh((n) => n + 1)}
          className="ld-btn ld-btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '13px' }}
        >
          <RefreshCw size={14} />
          Làm mới
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="ld-card" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Lọc theo trạng thái:</span>
        <select
          className="ld-select"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          style={{ maxWidth: 280, padding: '6px 12px', fontSize: '13px' }}
        >
          <option value={ALL_STATUSES}>Tất cả trạng thái</option>
          <option value={SUGGESTION_STATUS.PENDING}>Chờ Developer xử lý (Pending)</option>
          <option value={SUGGESTION_STATUS.ACCEPTED}>Đã chấp nhận (Accepted)</option>
          <option value={SUGGESTION_STATUS.DISMISSED}>Đã bỏ qua (Dismissed)</option>
          <option value={SUGGESTION_STATUS.SUPERSEDED}>Bị thay thế (Superseded)</option>
        </select>

        <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b' }}>
          Tổng số: <strong>{rows.length}</strong> gợi ý
        </span>
      </div>

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
          Đang tải danh sách gợi ý cập nhật...
        </div>
      )}

      {error && (
        <div style={{ padding: 16, backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, color: '#b91c1c', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" onClick={() => setRefresh((n) => n + 1)} className="ld-btn ld-btn-ghost" style={{ color: '#b91c1c' }}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="ld-card" style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
          <CheckCircle2 size={36} style={{ color: '#16a34a', marginBottom: 12 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#166534', margin: '0 0 6px 0' }}>
            Không có gợi ý cập nhật nào
          </h3>
          <p style={{ fontSize: '13px', margin: 0 }}>
            Hiện tại không có đề xuất thay đổi tài liệu nào ở trạng thái này.
          </p>
        </div>
      )}

      {/* Suggestion Cards */}
      {!loading && rows.map((row) => {
        const conf = row.confidence == null ? null : Math.round(row.confidence * 100)
        const st = statusConfig[row.status] || { label: row.status, bg: '#f1f5f9', text: '#475569' }
        return (
          <div
            key={row.id}
            className="ld-card"
            style={{
              padding: 20,
              marginBottom: 16,
              borderRadius: 8,
              transition: 'box-shadow 0.15s ease',
              border: row.status === 'Pending Developer Action' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  {row.documentTitle || row.documentId}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: st.bg, color: st.text, fontWeight: 600 }}>
                    {st.label}
                  </span>
                  {row.topSeverity && <SeverityBadge severity={row.topSeverity} compact />}
                  {conf !== null && (
                    <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: '#f0fdf4', color: '#166534', fontWeight: 600, border: '1px solid #bbf7d0' }}>
                      Độ tin cậy: {conf}%
                    </span>
                  )}
                  <span style={{ color: '#64748b' }}>Nguồn: {row.origin || 'drift'}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelected(row.id)}
                className="ld-btn ld-btn-primary"
                style={{ fontSize: '13px', padding: '6px 14px' }}
              >
                Xem chi tiết & Xử lý
              </button>
            </div>

            {/* Content snippet */}
            <div style={{ fontSize: '13px', color: '#334155', backgroundColor: '#f8fafc', padding: 12, borderRadius: 6, border: '1px solid #f1f5f9', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 90, overflow: 'hidden' }}>
              {(row.content || '').slice(0, 260)}{(row.content || '').length > 260 ? '…' : ''}
            </div>

            {row.createdAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#94a3b8', marginTop: 10 }}>
                <Clock size={13} />
                <span>Phát hiện lúc: {new Date(row.createdAt).toLocaleString('vi-VN')}</span>
              </div>
            )}
          </div>
        )
      })}

      <SuggestionDrawer
        suggestion={selectedRow}
        onClose={() => setSelected(null)}
        onDone={() => { setSelected(null); setRefresh((n) => n + 1) }}
      />
    </div>
  )
}
