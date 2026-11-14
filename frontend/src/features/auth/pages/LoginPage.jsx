import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../../layouts/AuthLayout';
import { useI18n } from '../../../i18n/I18nContext';
import { authApi } from '../authApi';
import { AlertCircle, Lock, Mail, Building2, ArrowRight } from 'lucide-react';

function GitHubIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState('demo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [error, setError] = useState(null);

  // Xử lý đăng nhập email & mật khẩu
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await authApi.loginWithEmail(tenant.trim(), email.trim(), password);

      if (res.accessToken) {
        localStorage.setItem('ld_token', res.accessToken);
        if (res.refreshToken) localStorage.setItem('ld_refresh_token', res.refreshToken);
        localStorage.setItem('ld_tenant', tenant.trim());
        navigate('/documents');
      }
    } catch (err) {
      setError(err?.detail || err?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý chuyển hướng GitHub OAuth (FR-AUTH-02)
  const handleGithubLogin = async () => {
    try {
      setGithubLoading(true);
      setError(null);

      // Định tuyến callback URL về frontend
      const redirectUri = `${window.location.origin}/auth/callback`;
      localStorage.setItem('ld_tenant', tenant.trim());

      const res = await authApi.getGitHubAuthUrl(tenant.trim(), redirectUri);
      if (res && res.url) {
        window.location.href = res.url;
      } else {
        throw new Error('Không nhận được URL xác thực từ hệ thống.');
      }
    } catch (err) {
      console.warn('Backend chưa khởi động hoặc chưa có endpoint, chuyển hướng chế độ Dev Mock:', err);
      // Fallback cho môi trường dev khi backend chưa nạp endpoint mới
      const redirectUri = `${window.location.origin}/auth/callback?code=mock_github_code_${tenant.trim()}&state=${tenant.trim()}`;
      window.location.href = redirectUri;
    } finally {
      setGithubLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t('auth.loginTitle') || 'Đăng nhập LivingDocs'}
      subtitle={t('auth.loginSubtitle') || 'Hệ thống tài liệu kỹ thuật tự cập nhật có hỗ trợ AI'}
    >
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Nút Đăng nhập với GitHub nổi bật (FR-AUTH-02) */}
      <button
        type="button"
        onClick={handleGithubLogin}
        disabled={githubLoading || loading}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          backgroundColor: '#24292f',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: githubLoading || loading ? 'not-allowed' : 'pointer',
          opacity: githubLoading || loading ? 0.7 : 1,
          transition: 'background-color 0.15s ease',
        }}
        onMouseOver={(e) => {
          if (!githubLoading && !loading) e.currentTarget.style.backgroundColor = '#1b1f23';
        }}
        onMouseOut={(e) => {
          if (!githubLoading && !loading) e.currentTarget.style.backgroundColor = '#24292f';
        }}
      >
        <GitHubIcon size={18} />
        {githubLoading ? 'Đang chuyển hướng sang GitHub...' : (t('auth.btnGithubLogin') || 'Đăng nhập với GitHub')}
      </button>

      {/* Đường phân cách */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          margin: '22px 0',
          color: '#94a3b8',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
        <span style={{ padding: '0 12px' }}>{t('auth.or') || 'hoặc email'}</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
      </div>

      {/* Form đăng nhập Email & Mật khẩu */}
      <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            {t('auth.tenantLabel') || 'Mã Workspace (Tenant)'}
          </label>
          <div style={{ position: 'relative' }}>
            <Building2
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="text"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              placeholder="demo"
              required
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                fontSize: '14px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            {t('auth.emailLabel') || 'Email'}
          </label>
          <div style={{ position: 'relative' }}>
            <Mail
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@example.com"
              required
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                fontSize: '14px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            {t('auth.passwordLabel') || 'Mật khẩu'}
          </label>
          <div style={{ position: 'relative' }}>
            <Lock
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                fontSize: '14px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || githubLoading}
          style={{
            marginTop: '8px',
            padding: '10px 16px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading || githubLoading ? 'not-allowed' : 'pointer',
            opacity: loading || githubLoading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {loading ? (t('auth.loggingIn') || 'Đang đăng nhập...') : (t('auth.btnLogin') || 'Đăng nhập')}
          <ArrowRight size={16} />
        </button>
      </form>
    </AuthLayout>
  );
}
