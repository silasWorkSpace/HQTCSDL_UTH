import apiClient from '../../services/api/apiClient';

/**
 * API Client dành riêng cho Authentication & GitHub OAuth (FR-AUTH-02)
 */
export const authApi = {
  // Lấy URL chuyển hướng GitHub OAuth
  getGitHubAuthUrl: async (tenant = 'demo', redirectUri) => {
    const params = new URLSearchParams();
    if (tenant) params.append('tenant', tenant);
    if (redirectUri) params.append('redirectUri', redirectUri);
    const res = await apiClient.get(`/api/v1/auth/github/url?${params.toString()}`);
    return res.data;
  },

  // Gửi callback code từ GitHub để nhận JWT Token
  callbackGitHub: async ({ code, tenant = 'demo', redirectUri }) => {
    const res = await apiClient.post('/api/v1/auth/github/callback', {
      code,
      tenant,
      redirectUri,
    });
    return res.data;
  },

  // Lấy danh sách Repositories từ GitHub của người dùng đã ủy quyền
  getGitHubRepos: async (githubToken) => {
    const headers = {};
    if (githubToken) {
      headers['X-GitHub-Token'] = githubToken;
    }
    const res = await apiClient.get('/api/v1/auth/github/repos', { headers });
    return res.data;
  },

  // Đăng nhập bằng Email / Mật khẩu
  loginWithEmail: async (tenant = 'demo', email, password) => {
    const res = await apiClient.post('/api/v1/auth/login', {
      tenant,
      email,
      password,
    });
    return res.data;
  },
};

export default authApi;
