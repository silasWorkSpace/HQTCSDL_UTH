import axios from 'axios'
import { tokenStore } from './tokenStore'

// VITE_API_BASE_URL de trong: goi cung origin, Vite proxy chuyen toi backend (xem vite.config.js).
const baseURL = import.meta.env.VITE_API_BASE_URL ?? ''

export const api = axios.create({ baseURL, timeout: 20000 })

let onAuthLost = () => {}
export function setAuthLostHandler(handler) {
  onAuthLost = handler
}

function newCorrelationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

// Dung axios tran (khong qua interceptor) de tranh lap vo han khi chinh viec refresh bi 401.
async function requestRefresh() {
  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) throw new Error('no-refresh-token')
  const { data } = await axios.post(`${baseURL}/api/v1/auth/refresh`, { refreshToken })
  tokenStore.setRefresh(data.refreshToken)
  tokenStore.setAccess(data.accessToken)
  return data
}

// Chi mot lan refresh chay cung luc (refresh token chi dung duoc mot lan, backend xoay vong).
let refreshing = null
export function refreshOnce() {
  if (!refreshing) {
    refreshing = requestRefresh().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess()
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['X-Correlation-Id'] = newCorrelationId()
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error
    const isAuthCall = config?.url?.includes('/api/v1/auth/')
    if (response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true
      try {
        await refreshOnce()
        return api(config)
      } catch {
        onAuthLost()
      }
    }
    return Promise.reject(error)
  },
)
