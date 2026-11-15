import { delay, http, HttpResponse } from 'msw'

// Dữ liệu giả cho notification-service (Người 4 làm backend thật theo cùng hợp đồng).
let notifications = [
  { id: 'n1', eventType: 'REVIEW_NEEDED', channel: 'in_app', payload: { message: 'Tài liệu API Payment cần bản duyệt' }, readAt: null, createdAt: new Date(Date.now() - 5 * 60_000).toISOString() },
  { id: 'n2', eventType: 'DRIFT_FOUND', channel: 'in_app', payload: { message: 'Phát hiện drift mức High trong PR #42' }, readAt: null, createdAt: new Date(Date.now() - 3_600_000).toISOString() },
  { id: 'n3', eventType: 'DOC_RETURNED', channel: 'in_app', payload: { message: 'Tài liệu Onboarding bị trả lại, xem lý do' }, readAt: new Date(Date.now() - 600_000).toISOString(), createdAt: new Date(Date.now() - 86_400_000).toISOString() },
]

export const handlers = [
  http.get('/api/v1/notifications', async ({ request }) => {
    await delay(150)
    const unread = new URL(request.url).searchParams.get('unread') === 'true'
    return HttpResponse.json(unread ? notifications.filter((n) => !n.readAt) : notifications)
  }),

  http.post('/api/v1/notifications/:id/read', ({ params }) => {
    notifications = notifications.map((n) => (n.id === params.id ? { ...n, readAt: new Date().toISOString() } : n))
    return new HttpResponse(null, { status: 204 })
  }),
]
