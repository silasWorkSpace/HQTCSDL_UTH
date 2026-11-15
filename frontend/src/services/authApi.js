import { api } from './apiClient'

export const authApi = {
  login: (tenant, email, password) => api.post('/api/v1/auth/login', { tenant, email, password }),
  register: (payload) => api.post('/api/v1/auth/register', payload),
  logout: (refreshToken) => api.post('/api/v1/auth/logout', refreshToken ? { refreshToken } : {}),
  me: async () => (await api.get('/api/v1/users/me')).data,
}
