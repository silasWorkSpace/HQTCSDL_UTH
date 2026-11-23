// MSW handlers cho gợi ý drift. /suggestions và /drift-alerts trả bản ghi thô của backend:
// tên cột snake_case, evidence là chuỗi JSON.
import { delay, http, HttpResponse } from 'msw'
import { MOCK_DEV_ID, problem, readToken, submitDocumentForReview } from './reviews'

const DOC_USERS = 'aaaaaaaa-0000-4000-8000-000000000001'
const DOC_WEBHOOK = 'aaaaaaaa-0000-4000-8000-000000000002'
const PENDING = 'Pending Developer Action'

const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString()

const evidenceUsers = JSON.stringify({
  entities: [
    { entity: 'UserController.createUser', kind: 'endpoint', severity: 'Critical', sections: ['Tạo người dùng'], message: 'Đường dẫn đổi từ POST /users sang POST /api/v2/users.', old: 'POST /users -> createUser(email: String): UserDto', new: 'POST /api/v2/users -> createUser(email: String, displayName: String): UserDto' },
    { entity: 'UserService.save', kind: 'method', severity: 'High', sections: ['Tham số'], message: 'Thêm tham số `displayName`.', old: 'save(email: String): User', new: 'save(email: String, displayName: String): User' },
  ],
  commit: '9f2c1ab7d3',
})
const evidenceWebhook = JSON.stringify({
  entities: [{ entity: 'WebhookHandler.verify', kind: 'method', severity: 'Medium', message: '`verify` được đổi tên thành `verifySignature`.', old: 'verify(payload: String): boolean', new: 'verifySignature(payload: String): boolean' }],
  commit: '41de88a002',
})

function seed() {
  return {
    suggestions: [
      { id: 'eeeeeeee-0000-4000-8000-000000000001', document_id: DOC_USERS, document_title: 'API Quản lý người dùng', drift_alert_id: 'ffffffff-0000-4000-8000-000000000001', origin: 'drift', content: '# API người dùng\n\nTạo người dùng bằng `POST /api/v2/users`.\n\n## Tham số\n- `email`\n- `displayName`', confidence_score: 0.9, evidence: evidenceUsers, status: PENDING, dismiss_reason: null, created_at: iso(60) },
      { id: 'eeeeeeee-0000-4000-8000-000000000002', document_id: DOC_WEBHOOK, document_title: 'Hướng dẫn tích hợp webhook', drift_alert_id: 'ffffffff-0000-4000-8000-000000000002', origin: 'drift', content: '# Webhook\n\nGitHub gọi `/webhooks/github`. Hàm `verifySignature` kiểm tra chữ ký HMAC.', confidence_score: 0.7, evidence: evidenceWebhook, status: PENDING, dismiss_reason: null, created_at: iso(30) },
      { id: 'eeeeeeee-0000-4000-8000-000000000003', document_id: DOC_USERS, document_title: 'API Quản lý người dùng', drift_alert_id: null, origin: 'auto_update', content: 'Bản tự cập nhật cũ.', confidence_score: 0.6, evidence: null, status: 'Superseded', dismiss_reason: null, created_at: iso(2000) },
    ],
    alerts: [
      { id: 'ffffffff-0000-4000-8000-000000000001', source_event_id: '99999999-0000-4000-8000-000000000001', document_id: DOC_USERS, drift_type: 'Signature', severity: 'Critical', evidence: evidenceUsers, handling_status: 'Open', created_at: iso(60) },
      { id: 'ffffffff-0000-4000-8000-000000000003', source_event_id: '99999999-0000-4000-8000-000000000003', document_id: DOC_USERS, drift_type: 'Semantic', severity: 'Low', evidence: JSON.stringify({ entities: [{ entity: 'UserService.find', kind: 'method', severity: 'Low', message: 'Phần thân thay đổi, chữ ký giữ nguyên.' }] }), handling_status: 'Dismissed', created_at: iso(3000) },
      { id: 'ffffffff-0000-4000-8000-000000000002', source_event_id: '99999999-0000-4000-8000-000000000002', document_id: DOC_WEBHOOK, drift_type: 'Referential', severity: 'Medium', evidence: evidenceWebhook, handling_status: 'Open', created_at: iso(30) },
    ],
    // Nội dung bản Published: chỉ tài liệu API người dùng có, để thấy cả hai trạng thái (có và chưa có bản để so sánh).
    published: { [DOC_USERS]: '# API người dùng\n\nTạo người dùng bằng `POST /users`.\n\n## Tham số\n- `email`' },
  }
}

let state = seed()

export function resetSuggestionsMock() {
  state = seed()
}

function findPending(id) {
  const s = state.suggestions.find((x) => x.id === id)
  if (!s) return { error: problem(404, 'Không tìm thấy', 'Gợi ý cập nhật không tồn tại') }
  if (s.status !== PENDING) return { error: problem(409, 'Xung đột nghiệp vụ', `Gợi ý đã ở trạng thái ${s.status}`) }
  return { suggestion: s }
}

// Backend cập nhật handling_status của drift_alert khi Developer xử lý gợi ý (DR-12).
function markAlert(suggestion, handlingStatus) {
  const alert = state.alerts.find((a) => a.id === suggestion.drift_alert_id)
  if (alert) alert.handling_status = handlingStatus
}

export const suggestionHandlers = [
  http.get('*/api/v1/suggestions', async ({ request }) => {
    await delay(150)
    const status = new URL(request.url).searchParams.get('status')
    const list = state.suggestions.filter((s) => !status || s.status === status)
    return HttpResponse.json([...list].sort((a, b) => b.created_at.localeCompare(a.created_at)))
  }),

  http.get('*/api/v1/documents/:id/drift-alerts', async ({ params }) => {
    await delay(150)
    return HttpResponse.json(state.alerts.filter((a) => a.document_id === params.id))
  }),

  // Chỉ để màn hình so sánh có dữ liệu khi mock. Bỏ handler này nếu mock của Người 3 đã có GET /documents/:id.
  http.get('*/api/v1/documents/:id', async ({ params }) => {
    await delay(100)
    const publishedContent = state.published[params.id]
    return HttpResponse.json({ id: params.id, ...(publishedContent ? { publishedContent } : {}) })
  }),

  http.post('*/api/v1/suggestions/:id/accept', async ({ params, request }) => {
    await delay(200)
    const { suggestion, error } = findPending(params.id)
    if (error) return error
    suggestion.status = 'Accepted'
    markAlert(suggestion, 'Accepted')
    submitDocumentForReview(suggestion.document_id, readToken(request).sub ?? MOCK_DEV_ID)
    return HttpResponse.json({ id: suggestion.id, action: 'accept' })
  }),

  http.post('*/api/v1/suggestions/:id/edit', async ({ params, request }) => {
    await delay(200)
    const { suggestion, error } = findPending(params.id)
    if (error) return error
    const body = await request.json()
    if (!(body?.content ?? '').trim()) return problem(400, 'Yêu cầu không hợp lệ', 'Nội dung sửa không được để trống')
    suggestion.status = 'Accepted'
    suggestion.content = body.content
    markAlert(suggestion, 'Accepted')
    submitDocumentForReview(suggestion.document_id, readToken(request).sub ?? MOCK_DEV_ID)
    return HttpResponse.json({ id: suggestion.id, action: 'edit' })
  }),

  http.post('*/api/v1/suggestions/:id/dismiss', async ({ params, request }) => {
    await delay(200)
    const { suggestion, error } = findPending(params.id)
    if (error) return error
    const body = await request.json()
    if (!(body?.reason ?? '').trim()) return problem(400, 'Yêu cầu không hợp lệ', 'Dismiss bắt buộc ghi lý do')
    suggestion.status = 'Dismissed'
    suggestion.dismiss_reason = body.reason
    markAlert(suggestion, 'Dismissed')
    return HttpResponse.json({ id: suggestion.id, action: 'dismiss' })
  }),
]
