// Chuẩn hóa dữ liệu của /suggestions và /drift-alerts. Hai API này trả bản ghi thô nên tên
// cột là snake_case và evidence là chuỗi JSON; phần còn lại của giao diện chỉ dùng dạng đã chuẩn hóa.
import { maxSeverity, severityRank } from '../../constants/severity'
import { MIN_OTHER_REASON_LENGTH, OTHER_REASON, SUGGESTION_STATUS } from './constants'

function pick(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return null
}

export function parseJson(value) {
  if (value == null || value === '') return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeEntity(e) {
  return {
    entity: e?.entity ?? '',
    kind: e?.kind ?? null,
    severity: e?.severity ?? null,
    sections: Array.isArray(e?.sections) ? e.sections : [],
    message: e?.message ?? '',
    oldSignature: e?.old ?? null,
    newSignature: e?.new ?? null,
  }
}

/** Bằng chứng: file, thực thể code, commit, diff, ticket (DR-07). */
export function normalizeEvidence(raw) {
  const ev = parseJson(raw)
  if (!ev || typeof ev !== 'object') {
    return { entities: [], commit: null, file: null, ticket: null, diff: null }
  }
  return {
    entities: Array.isArray(ev.entities) ? ev.entities.map(normalizeEntity) : [],
    commit: pick(ev, 'commit', 'commitHash', 'commit_hash'),
    file: pick(ev, 'file', 'filePath', 'file_path'),
    ticket: pick(ev, 'ticket', 'ticketId'),
    diff: pick(ev, 'diff'),
  }
}

export function hasEvidence(evidence) {
  return Boolean(
    evidence &&
      (evidence.entities.length || evidence.commit || evidence.file || evidence.ticket || evidence.diff),
  )
}

function toConfidence(value) {
  if (value == null) return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return Math.min(1, Math.max(0, n))
}

export function confidencePercent(confidence) {
  return confidence == null ? null : Math.round(confidence * 100)
}

export function normalizeSuggestion(raw) {
  const evidence = normalizeEvidence(pick(raw, 'evidence'))
  return {
    id: raw.id,
    documentId: pick(raw, 'document_id', 'documentId'),
    documentTitle: pick(raw, 'document_title', 'documentTitle') ?? '',
    driftAlertId: pick(raw, 'drift_alert_id', 'driftAlertId'),
    origin: pick(raw, 'origin') ?? '',
    content: pick(raw, 'content') ?? '',
    confidence: toConfidence(pick(raw, 'confidence_score', 'confidenceScore')),
    evidence,
    topSeverity: maxSeverity(evidence.entities.map((e) => e.severity)),
    status: pick(raw, 'status'),
    dismissReason: pick(raw, 'dismiss_reason', 'dismissReason'),
    createdAt: pick(raw, 'created_at', 'createdAt'),
  }
}

export function normalizeDriftAlert(raw) {
  return {
    id: raw.id,
    sourceEventId: pick(raw, 'source_event_id', 'sourceEventId'),
    documentId: pick(raw, 'document_id', 'documentId'),
    driftType: pick(raw, 'drift_type', 'driftType'),
    severity: pick(raw, 'severity'),
    evidence: normalizeEvidence(pick(raw, 'evidence')),
    handlingStatus: pick(raw, 'handling_status', 'handlingStatus'),
    createdAt: pick(raw, 'created_at', 'createdAt'),
  }
}

export function isPending(suggestion) {
  return suggestion?.status === SUGGESTION_STATUS.PENDING
}

/** Mức nghiêm trọng cao trước, cùng mức thì mới nhất trước. */
export function sortSuggestions(list) {
  return [...list].sort((a, b) => {
    const bySeverity = severityRank(b.topSeverity) - severityRank(a.topSeverity)
    if (bySeverity !== 0) return bySeverity
    return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))
  })
}

/** Lý do gửi lên backend; trả null nếu chưa hợp lệ (Dismiss bắt buộc có lý do, AUTO-09). */
export function buildDismissReason({ code, note }, labelOf) {
  if (!code) return null
  if (code === OTHER_REASON) {
    const text = (note ?? '').trim()
    return text.length >= MIN_OTHER_REASON_LENGTH ? `${labelOf(code)}: ${text}` : null
  }
  return labelOf(code)
}

export function filterAlerts(alerts, { severity, handlingStatus } = {}) {
  return alerts.filter(
    (a) => (!severity || a.severity === severity) && (!handlingStatus || a.handlingStatus === handlingStatus),
  )
}

/** Tài liệu duy nhất xuất hiện trong danh sách gợi ý, dùng làm lựa chọn ở trang Lịch sử drift. */
export function uniqueDocuments(suggestions) {
  const seen = new Map()
  for (const s of suggestions) {
    if (s.documentId && !seen.has(s.documentId)) {
      seen.set(s.documentId, { id: s.documentId, title: s.documentTitle || s.documentId })
    }
  }
  return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title))
}

/** Nội dung bản Published của tài liệu; null nếu API tài liệu chưa trả (không dùng bản nháp thay thế). */
export function extractPublishedContent(doc) {
  return (
    pick(doc, 'publishedContent', 'published_content') ??
    pick(doc?.publishedVersion, 'content') ??
    pick(doc?.published_version, 'content') ??
    null
  )
}
