import axios from 'axios';

/**
 * Axios instance chuẩn kết nối backend LivingDocs
 * Hỗ trợ tự động gắn token JWT, tenant header, và trích xuất lỗi Problem Details (RFC 7807)
 */
const baseURL = import.meta.env?.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshInFlight = null;

function csrfCookie() {
  const pair = document.cookie.split('; ').find((item) => item.startsWith('ld_csrf='));
  return pair ? decodeURIComponent(pair.substring('ld_csrf='.length)) : null;
}

function isUnsafeMethod(method) {
  return !['get', 'head', 'options'].includes(String(method || 'get').toLowerCase());
}

// Browser identity is carried by HttpOnly cookies; the CSRF token is double submitted.
apiClient.interceptors.request.use(
  (config) => {
    const csrf = csrfCookie();
    if (csrf && isUnsafeMethod(config.method)) config.headers['X-CSRF-Token'] = csrf;

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Chuẩn hóa Problem Details
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const url = String(request?.url || '');
    const isAuthEntry = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/github/callback', '/api/v1/auth/csrf']
      .some((path) => url.includes(path));
    if (error.response?.status === 401 && request && !request._retried && !isAuthEntry
        && !url.includes('/api/v1/auth/refresh')) {
      request._retried = true;
      try {
        const csrf = csrfCookie();
        refreshInFlight ||= axios.post(`${baseURL}/api/v1/auth/refresh`, null, {
          withCredentials: true,
          headers: csrf ? { 'X-CSRF-Token': csrf } : {},
        });
        await refreshInFlight;
        refreshInFlight = null;
        window.dispatchEvent(new Event('livingdocs:session-changed'));
        return apiClient(request);
      } catch (refreshError) {
        refreshInFlight = null;
        localStorage.removeItem('ld_token');
        localStorage.removeItem('ld_refresh_token');
        localStorage.removeItem('ld_github_connection_id');
        window.dispatchEvent(new Event('livingdocs:session-changed'));
        error = refreshError;
      }
    }
    if (error.response) {
      const data = error.response.data;
      const problem = {
        status: error.response.status,
        title: data?.title || error.response.statusText || 'Lỗi hệ thống',
        detail: data?.detail || data?.message || 'Có lỗi xảy ra khi xử lý yêu cầu.',
        code: data?.code || null,
        raw: data,
      };
      return Promise.reject(problem);
    }
    return Promise.reject({
      status: 0,
      title: 'Lỗi mạng / Không thể kết nối',
      detail: error.message || 'Không thể kết nối đến máy chủ backend.',
    });
  }
);

export default apiClient;
