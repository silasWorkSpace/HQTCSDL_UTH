// MSW handlers cho workflow-service (duyệt). Định dạng khớp phản hồi thật của backend:
// ReviewTaskView dạng camelCase, GET /reviews/{id} trả { task, document, versionUnderReview, changeLog,
// lastApprovedVersion, decisions, comments }. Lỗi theo Problem Details.
import { delay, http, HttpResponse } from 'msw'

export const MOCK_DEV_ID = '00000000-0000-4000-8000-0000000000d1'
const DOC_USERS = 'aaaaaaaa-0000-4000-8000-000000000001'
const DOC_WEBHOOK = 'aaaaaaaa-0000-4000-8000-000000000002'
const DOC_SELF = 'aaaaaaaa-0000-4000-8000-000000000003'

export function problem(status, title, detail) {
  return HttpResponse.json(
    { type: 'about:blank', title, status, detail },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

/** Đọc sub và roles từ JWT trong header Authorization; không đọc được thì trả null. */
export function readToken(request) {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  try {
    const body = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(body))
    return { sub: payload.sub ?? null, roles: payload.roles ?? (payload.role ? [payload.role] : null) }
  } catch {
    return { sub: null, roles: null }
  }
}

const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString()
let counter = 100
const nextId = (prefix) => `${prefix}-0000-4000-8000-${String(++counter).padStart(12, '0')}`

function version(id, no, content, role, source, status, minutesAgo) {
  return { id, versionNo: no, content, actorRole: role, changeSource: source, statusAtVersion: status, createdAt: iso(minutesAgo) }
}

function seed() {
  return {
    documents: {
      [DOC_USERS]: { id: DOC_USERS, title: 'API Quản lý người dùng', docStatus: 'IN_REVIEW_STAFF', ownerId: MOCK_DEV_ID },
      [DOC_WEBHOOK]: { id: DOC_WEBHOOK, title: 'Hướng dẫn tích hợp webhook', docStatus: 'IN_REVIEW_MANAGER', ownerId: MOCK_DEV_ID },
    },
    versions: {
      [DOC_USERS]: [
        version('bbbbbbbb-0000-4000-8000-000000000001', 1, '# API người dùng\n\nTạo người dùng bằng `POST /users`.\n\n## Tham số\n- `email`', 'AI', 'AI_GENERATED', 'APPROVED', 4000),
        version('bbbbbbbb-0000-4000-8000-000000000002', 2, '# API người dùng\n\nTạo người dùng bằng `POST /users`.\n\n## Tham số\n- `email`\n- `displayName` (mới)\n\n## Lỗi\n- 409 khi email đã tồn tại', 'Developer', 'DRIFT_SUGGESTION', 'IN_REVIEW_STAFF', 90),
      ],
      [DOC_WEBHOOK]: [
        version('bbbbbbbb-0000-4000-8000-000000000003', 1, '# Webhook\n\nGitHub gọi `/webhooks/github` kèm chữ ký HMAC.', 'AI', 'AI_GENERATED', 'APPROVED', 5000),
        version('bbbbbbbb-0000-4000-8000-000000000004', 2, '# Webhook\n\nGitHub gọi `/webhooks/github` kèm chữ ký HMAC.\n\nSự kiện trùng được bỏ qua (idempotent).', 'Developer', 'MANUAL', 'IN_REVIEW_MANAGER', 300),
      ],
    },
    tasks: [
      { id: 'cccccccc-0000-4000-8000-000000000001', documentId: DOC_USERS, documentTitle: 'API Quản lý người dùng', documentVersionId: 'bbbbbbbb-0000-4000-8000-000000000002', level: 'Staff', submitterId: MOCK_DEV_ID, submitterName: 'Dev Minh', assigneeId: null, status: 'Pending', docStatus: 'IN_REVIEW_STAFF', createdAt: iso(90) },
      { id: 'cccccccc-0000-4000-8000-000000000002', documentId: DOC_WEBHOOK, documentTitle: 'Hướng dẫn tích hợp webhook', documentVersionId: 'bbbbbbbb-0000-4000-8000-000000000004', level: 'Manager', submitterId: MOCK_DEV_ID, submitterName: 'Dev Minh', assigneeId: null, status: 'Pending', docStatus: 'IN_REVIEW_MANAGER', createdAt: iso(300) },
    ],
    decisions: {
      'cccccccc-0000-4000-8000-000000000002': [
        { reviewerId: 'dddddddd-0000-4000-8000-000000000001', reviewerName: 'Staff Lan', decision: 'APPROVE', reason: null, decidedAt: iso(240) },
      ],
    },
    comments: {
      'cccccccc-0000-4000-8000-000000000002': [
        { userId: 'dddddddd-0000-4000-8000-000000000001', userName: 'Staff Lan', content: 'Mục sự kiện trùng đã đủ rõ.', lineNumber: 4, createdAt: iso(241) },
      ],
    },
    selfSamples: new Set(),
  }
}

let state = seed()

export function resetReviewsMock() {
  state = seed()
}

function toTaskView(task) {
  const doc = state.documents[task.documentId]
  return { ...task, docStatus: doc?.docStatus ?? task.docStatus }
}

function latestVersion(documentId) {
  const list = state.versions[documentId] ?? []
  return list[list.length - 1] ?? null
}

/** Dùng khi Developer Accept gợi ý: tài liệu được nộp vào duyệt Staff. */
export function submitDocumentForReview(documentId, submitterId) {
  const doc = state.documents[documentId]
  if (!doc) return null
  const v = latestVersion(documentId)
  doc.docStatus = 'IN_REVIEW_STAFF'
  const task = {
    id: nextId('cccccccc'), documentId, documentTitle: doc.title, documentVersionId: v?.id ?? null, level: 'Staff',
    submitterId: submitterId ?? MOCK_DEV_ID, submitterName: 'Dev Minh', assigneeId: null, status: 'Pending',
    docStatus: 'IN_REVIEW_STAFF', createdAt: new Date().toISOString(),
  }
  state.tasks.push(task)
  return task
}

/** Mỗi người dùng có một tài liệu do chính họ nộp ở mỗi cấp, để thử nút duyệt bị khóa (WF-22). */
function ensureSelfSample(level, sub) {
  const key = `${level}:${sub}`
  if (!sub || state.selfSamples.has(key)) return
  state.selfSamples.add(key)
  state.documents[DOC_SELF] ??= { id: DOC_SELF, title: 'Tài liệu bạn đã nộp (mẫu tách biệt nhiệm vụ)', docStatus: 'IN_REVIEW_STAFF', ownerId: sub }
  state.versions[DOC_SELF] ??= [version('bbbbbbbb-0000-4000-8000-000000000005', 1, '# Tài liệu mẫu\n\nBạn là người nộp bản này.', 'Developer', 'MANUAL', 'IN_REVIEW_STAFF', 20)]
  state.tasks.push({
    id: nextId('cccccccc'), documentId: DOC_SELF, documentTitle: state.documents[DOC_SELF].title,
    documentVersionId: 'bbbbbbbb-0000-4000-8000-000000000005', level: level === 'manager' ? 'Manager' : 'Staff',
    submitterId: sub, submitterName: 'Bạn', assigneeId: null, status: 'Pending', docStatus: 'IN_REVIEW_STAFF', createdAt: iso(20),
  })
}

const NEEDS_REASON = ['REJECT', 'RETURN', 'REQUEST_CHANGES']

export const reviewHandlers = [
  http.get('*/api/v1/reviews/queue', async ({ request }) => {
    await delay(150)
    const level = (new URL(request.url).searchParams.get('level') ?? 'staff').toLowerCase()
    ensureSelfSample(level, readToken(request).sub)
    const list = state.tasks.filter((t) => t.level.toLowerCase() === level && t.status === 'Pending')
    return HttpResponse.json(list.map(toTaskView))
  }),

  http.get('*/api/v1/reviews/:id', async ({ params }) => {
    await delay(150)
    const task = state.tasks.find((t) => t.id === params.id)
    if (!task) return problem(404, 'Không tìm thấy', 'Review task không tồn tại')
    const versions = state.versions[task.documentId] ?? []
    const underReview = versions.find((v) => v.id === task.documentVersionId) ?? null
    const approved = [...versions].filter((v) => v.statusAtVersion === 'APPROVED' && v.id !== task.documentVersionId).pop() ?? null
    const body = {
      task: toTaskView(task),
      document: state.documents[task.documentId] ?? null,
      changeLog: versions,
      decisions: state.decisions[task.id] ?? [],
      comments: state.comments[task.id] ?? [],
    }
    if (underReview) body.versionUnderReview = underReview
    if (approved) body.lastApprovedVersion = approved
    return HttpResponse.json(body)
  }),

  http.post('*/api/v1/reviews/:id/decisions', async ({ params, request }) => {
    await delay(200)
    const { sub, roles } = readToken(request)
    const task = state.tasks.find((t) => t.id === params.id)
    if (!task) return problem(404, 'Không tìm thấy', 'Review task không tồn tại')
    const body = await request.json()
    if (!body?.decision) return problem(400, 'Yêu cầu không hợp lệ', 'Thiếu quyết định duyệt')
    if (task.status !== 'Pending') return problem(409, 'Xung đột nghiệp vụ', `Review task đã được xử lý (${task.status})`)
    if (roles && !roles.includes(task.level) && !roles.includes('Administrator')) {
      return problem(403, 'Không đủ quyền', `Task này thuộc cấp ${task.level}, vai trò bạn không thể duyệt`)
    }
    if (sub && task.submitterId === sub) {
      return problem(403, 'Không đủ quyền', 'Người nộp không được duyệt bản của chính mình (FR-WF-22)')
    }
    if (NEEDS_REASON.includes(body.decision) && !(body.reason ?? '').trim()) {
      return problem(400, 'Yêu cầu không hợp lệ', 'Từ chối hoặc trả lại bắt buộc ghi lý do')
    }

    const doc = state.documents[task.documentId]
    const now = new Date().toISOString()
    ;(state.decisions[task.id] ??= []).push({ reviewerId: sub ?? 'mock-reviewer', reviewerName: 'Bạn (mock)', decision: body.decision, reason: body.reason ?? null, decidedAt: now })
    for (const c of body.comments ?? []) {
      ;(state.comments[task.id] ??= []).push({ userId: sub ?? 'mock-reviewer', userName: 'Bạn (mock)', content: c.content, lineNumber: c.lineNumber ?? null, createdAt: now })
    }

    const followUp = (level, docStatus) => {
      doc.docStatus = docStatus
      state.tasks.push({ ...task, id: nextId('cccccccc'), level, status: 'Pending', docStatus, createdAt: now })
    }
    if (body.decision === 'APPROVE') {
      task.status = 'Approved'
      if (task.level === 'Staff') followUp('Manager', 'IN_REVIEW_MANAGER')
      else doc.docStatus = 'PUBLISHED'
    } else if (body.decision === 'RETURN') {
      task.status = 'Returned'
      followUp('Staff', 'IN_REVIEW_STAFF')
    } else {
      task.status = 'Rejected'
      doc.docStatus = 'REJECTED'
    }
    return HttpResponse.json(toTaskView(task))
  }),
]
