import { api } from './apiClient'

export const adminApi = {
  async listUsers(page, size) {
    const { data } = await api.get('/api/v1/admin/users', { params: { page, size } })
    return Array.isArray(data) ? data : []
  },
  async updateRoles(id, roles) {
    const { data } = await api.put(`/api/v1/admin/users/${id}/roles`, { roles })
    return data
  },
  async updateStatus(id, status) {
    await api.put(`/api/v1/admin/users/${id}/status`, { status })
  },
}
