import axios from 'axios';

/**
 * Axios instance chuẩn kết nối backend LivingDocs
 * Hỗ trợ tự động gắn token JWT, tenant header, và trích xuất lỗi Problem Details (RFC 7807)
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || '';

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Gắn JWT Token và Tenant Header
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ld_token') || sessionStorage.getItem('ld_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const tenant = localStorage.getItem('ld_tenant') || 'demo';
    config.headers['X-Tenant'] = tenant;
    config.headers['X-Tenant-Id'] = tenant;

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Chuẩn hóa Problem Details
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
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
