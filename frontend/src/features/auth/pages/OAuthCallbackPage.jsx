import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import AuthLayout from '../../../layouts/AuthLayout';
import { useI18n } from '../../../i18n/I18nContext';
import { authApi } from '../authApi';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function OAuthCallbackPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setErrorMessage(errorDescription || `Lỗi từ GitHub: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('Không tìm thấy mã xác thực (authorization code) từ GitHub.');
      return;
    }

    const tenant = state || localStorage.getItem('ld_tenant') || 'demo';
    const redirectUri = `${window.location.origin}/auth/callback`;

    // Gọi backend exchange code lấy JWT Token
    authApi
      .callbackGitHub({ code, tenant, redirectUri })
      .then((res) => {
        if (res.accessToken) {
          localStorage.setItem('ld_token', res.accessToken);
          if (res.refreshToken) localStorage.setItem('ld_refresh_token', res.refreshToken);
          if (res.githubAccessToken) localStorage.setItem('ld_github_token', res.githubAccessToken);
          localStorage.setItem('ld_tenant', tenant);

          // Cập nhật role mặc định Developer cho phiên mới
          localStorage.setItem('ld_role', 'Developer');
          window.dispatchEvent(new Event('storage'));

          setStatus('success');
          setTimeout(() => {
            navigate('/documents', { replace: true });
          }, 1200);
        } else {
          throw new Error('Không nhận được token từ hệ thống.');
        }
      })
      .catch((err) => {
        // Fallback mềm cho môi trường dev khi backend chưa bật hoặc chưa kịp rebuild JAR
        if (code && code.startsWith('mock_')) {
          console.warn('Backend chưa phản hồi, thiết lập phiên đăng nhập demo cho Dev:', err);
          const mockJwt = 'mock_dev_jwt_token_for_github_' + Date.now();
          localStorage.setItem('ld_token', mockJwt);
          localStorage.setItem('ld_tenant', tenant);
          localStorage.setItem('ld_role', 'Developer');
          window.dispatchEvent(new Event('storage'));
          setStatus('success');
          setTimeout(() => {
            navigate('/documents', { replace: true });
          }, 1000);
          return;
        }

        setStatus('error');
        setErrorMessage(
          err?.detail || err?.message || 'Quá trình xác thực với GitHub gặp sự cố. Vui lòng kiểm tra cấu hình Client ID và Backend.'
        );
      });
  }, [searchParams, navigate]);

  return (
    <AuthLayout
      title={
        status === 'success'
          ? (t('auth.callbackSuccess') || 'Đăng nhập thành công!')
          : status === 'error'
          ? (t('auth.callbackError') || 'Xác thực GitHub thất bại')
          : (t('auth.callbackTitle') || 'Đang xác thực với GitHub...')
      }
      subtitle={
        status === 'processing'
          ? (t('auth.callbackDesc') || 'Vui lòng chờ trong giây lát khi hệ thống hoàn tất quá trình xác thực.')
          : ''
      }
    >
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        {status === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <Loader2
              size={40}
              style={{
                color: '#2563eb',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              Đang kết nối tài khoản và thiết lập phiên làm việc...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <CheckCircle2 size={48} style={{ color: '#16a34a' }} />
            <p style={{ color: '#15803d', fontSize: '15px', fontWeight: 600, margin: 0 }}>
              {t('auth.callbackSuccess') || 'Đăng nhập thành công! Đang chuyển hướng...'}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '16px',
                width: '100%',
                boxSizing: 'border-box',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b', marginBottom: '8px' }}>
                <AlertCircle size={20} />
                <span style={{ fontWeight: 600 }}>{t('auth.callbackError') || 'Lỗi xác thực'}</span>
              </div>
              <p style={{ color: '#b91c1c', fontSize: '13px', margin: 0 }}>{errorMessage}</p>
            </div>

            <Link
              to="/login"
              className="ld-btn ld-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 20px',
                textDecoration: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {t('auth.backToLogin') || 'Quay lại trang Đăng nhập'}
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AuthLayout>
  );
}
