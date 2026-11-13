// Quy tắc hiển thị của màn hình duyệt. Mọi quyết định cuối cùng do server đưa ra (NFR-SEC-02);
// phần này chỉ để ẩn, vô hiệu hóa nút và báo trước cho người dùng.
import { shortId } from '../shared/format'

export const DECISION = Object.freeze({
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  RETURN: 'RETURN',
  REQUEST_CHANGES: 'REQUEST_CHANGES',
})

const REASON_REQUIRED = [DECISION.REJECT, DECISION.RETURN, DECISION.REQUEST_CHANGES]

/** Cấp hàng đợi mà các vai trò này được xem (WF-12): Staff -> staff, Manager -> manager. */
export function queueLevelsFor(roles = []) {
  const set = new Set(roles)
  if (set.has('Administrator')) return ['staff', 'manager']
  const levels = []
  if (set.has('Staff')) levels.push('staff')
  if (set.has('Manager')) levels.push('manager')
  return levels
}

/** Staff: duyệt chuyển lên Manager hoặc từ chối. Manager: phê duyệt, từ chối hoặc trả lại. */
export function decisionOptions(level) {
  return String(level).toLowerCase() === 'manager'
    ? [DECISION.APPROVE, DECISION.REJECT, DECISION.RETURN]
    : [DECISION.APPROVE, DECISION.REJECT]
}

export function reasonRequired(decision) {
  return REASON_REQUIRED.includes(decision)
}

/** Trả { valid, error } với error là khóa i18n con của reviews.decision.errors. */
export function validateDecision({ decision, reason, level }) {
  if (!decision) return { valid: false, error: 'decisionRequired' }
  if (!decisionOptions(level).includes(decision)) return { valid: false, error: 'notAllowed' }
  if (reasonRequired(decision) && !(reason ?? '').trim()) return { valid: false, error: 'reasonRequired' }
  return { valid: true, error: null }
}

/**
 * Lý do không được duyệt: 'closed' (task đã xử lý), 'self' (người nộp, WF-22),
 * 'role' (không có vai trò của cấp này); null nếu được phép.
 */
export function decisionBlock({ task, user }) {
  if (!task || !user) return 'role'
  if (task.status !== 'Pending') return 'closed'
  if (task.submitterId && task.submitterId === user.id) return 'self'
  if (!queueLevelsFor(user.roles).includes(String(task.level).toLowerCase())) return 'role'
  return null
}

function toLineNumber(value) {
  if (value === '' || value == null) return null
  const n = Number.parseInt(value, 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Body của POST /reviews/{id}/decisions; bỏ comment rỗng. */
export function buildDecisionPayload({ decision, reason, comments = [] }) {
  const text = (reason ?? '').trim()
  return {
    decision,
    reason: text || null,
    comments: comments
      .map((c) => ({ content: (c.content ?? '').trim(), lineNumber: toLineNumber(c.lineNumber) }))
      .filter((c) => c.content),
  }
}

export function normalizeTask(raw) {
  if (!raw) return null
  return {
    id: raw.id,
    documentId: raw.documentId ?? null,
    documentTitle: raw.documentTitle ?? '',
    documentVersionId: raw.documentVersionId ?? null,
    level: raw.level ?? '',
    submitterId: raw.submitterId ?? null,
    submitterName: raw.submitterName ?? null,
    assigneeId: raw.assigneeId ?? null,
    status: raw.status ?? '',
    docStatus: raw.docStatus ?? null,
    createdAt: raw.createdAt ?? null,
  }
}

export function normalizeReviewDetail(raw) {
  const decisions = (raw?.decisions ?? []).map((d) => ({
    reviewerId: d.reviewerId ?? null,
    reviewerName: d.reviewerName ?? null,
    decision: d.decision,
    reason: d.reason ?? null,
    decidedAt: d.decidedAt ?? null,
  }))
  const comments = (raw?.comments ?? []).map((c) => ({
    userId: c.userId ?? null,
    userName: c.userName ?? null,
    content: c.content ?? '',
    lineNumber: c.lineNumber ?? null,
    createdAt: c.createdAt ?? null,
  }))
  return {
    task: normalizeTask(raw?.task),
    document: raw?.document ?? null,
    version: raw?.versionUnderReview ?? null,
    changeLog: [...(raw?.changeLog ?? [])].sort((a, b) => a.versionNo - b.versionNo),
    lastApproved: raw?.lastApprovedVersion ?? null,
    decisions,
    comments,
  }
}

/** Tên hiển thị của người duyệt hoặc người comment, rơi về 8 ký tự đầu của id. */
export function personLabel(name, id) {
  return name || shortId(id)
}
