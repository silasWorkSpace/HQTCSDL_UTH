import apiClient from '../../services/api/apiClient.js';

/**
 * API Client dành riêng cho Authentication & GitHub OAuth (FR-AUTH-02)
 */
export const authApi = {
  // Lấy URL chuyển hướng GitHub OAuth
  getGitHubAuthUrl: async (tenant, redirectUri) => {
    const params = new URLSearchParams();
    if (tenant) params.append('tenant', tenant);
    if (redirectUri) params.append('redirectUri', redirectUri);
    const res = await apiClient.get(`/api/v1/auth/github/url?${params.toString()}`);
    return res.data;
  },

  // Gửi callback code từ GitHub để nhận JWT Token
  callbackGitHub: async ({ code, state, redirectUri }) => {
    const res = await apiClient.post('/api/v1/auth/github/callback', {
      code,
      state,
      redirectUri,
    }, { timeout: 60000 });
    return res.data;
  },

  // Lấy danh sách Repositories từ GitHub của người dùng đã ủy quyền
  // Đăng nhập bằng Email / Mật khẩu
  loginWithEmail: async (tenant, email, password) => {
    const res = await apiClient.post('/api/v1/auth/login', {
      tenant,
      email,
      password,
    });
    return res.data;
  },

  // Đổi vai trò tài khoản hiện tại (Demo & Test)
  switchRole: async (role) => {
    const res = await apiClient.post('/api/v1/users/me/switch-role', { role });
    return res.data;
  },

  // Đăng nhập nhanh 1-click tài khoản mẫu (Demo dev-token)
  devLogin: async (tenant, email, roles) => {
    const res = await apiClient.post('/api/v1/auth/dev-token', {
      tenant: tenant || 'demo',
      email,
      roles: Array.isArray(roles) ? roles : [roles],
    });
    return res.data;
  },

  logout: async () => apiClient.post('/api/v1/auth/logout'),
};

export default authApi;
