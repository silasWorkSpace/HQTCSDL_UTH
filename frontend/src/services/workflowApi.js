// Hàm gọi workflow-service (gợi ý drift và duyệt). Đổi giữa API thật và mock bằng VITE_API_MODE
// ở apiClient/MSW, file này không cần biết.
import * as clientModule from './api/apiClient'
import { extractPublishedContent } from '../features/suggestions/model'

// Bỏ tiền tố nếu baseURL của apiClient đã có sẵn /api/v1.
const API = '/api/v1'

function http() {
  return clientModule.default ?? clientModule.apiClient
}

export async function listSuggestions(status) {
  const { data } = await http().get(`${API}/suggestions`, { params: status ? { status } : undefined })
  return data
}

export async function listDriftAlerts(documentId) {
  const { data } = await http().get(`${API}/documents/${documentId}/drift-alerts`)
  return data
}

export async function acceptSuggestion(id) {
  const { data } = await http().post(`${API}/suggestions/${id}/accept`)
  return data
}

export async function editSuggestion(id, content) {
  const { data } = await http().post(`${API}/suggestions/${id}/edit`, { content })
  return data
}

export async function dismissSuggestion(id, reason) {
  const { data } = await http().post(`${API}/suggestions/${id}/dismiss`, { reason })
  return data
}

/** Nội dung bản Published gần nhất để so sánh; null nếu API tài liệu chưa trả. */
export async function fetchPublishedContent(documentId) {
  const { data } = await http().get(`${API}/documents/${documentId}`)
  return extractPublishedContent(data)
}

export async function listReviewQueue(level) {
  const { data } = await http().get(`${API}/reviews/queue`, { params: { level } })
  return data
}

export async function getReview(taskId) {
  const { data } = await http().get(`${API}/reviews/${taskId}`)
  return data
}

export async function decideReview(taskId, payload) {
  const { data } = await http().post(`${API}/reviews/${taskId}/decisions`, payload)
  return data
}
