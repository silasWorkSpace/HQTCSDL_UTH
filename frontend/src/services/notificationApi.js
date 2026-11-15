import { api } from './apiClient'

// Hop dong thong nhat voi notification-service (Nguoi 4):
//   GET  /api/v1/notifications?unread=&page=&size=  -> [{ id, eventType, channel, payload, readAt, createdAt }]
//   POST /api/v1/notifications/{id}/read            -> 204
export const notificationApi = {
  async list({ unread = false, page = 0, size = 20 } = {}) {
    const { data } = await api.get('/api/v1/notifications', { params: { unread, page, size } })
    return Array.isArray(data) ? data : []
  },
  async markRead(id) {
    await api.post(`/api/v1/notifications/${id}/read`)
  },
}
