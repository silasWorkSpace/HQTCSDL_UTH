import { Spin, Typography } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useAuth } from '../features/auth/useAuth'

// Khung trang dang nhap, dang ky. Da dang nhap roi thi chuyen ve trang truoc do (hoac trang chu).
export default function AuthLayout() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Spin fullscreen />
  if (status === 'authenticated') {
    return <Navigate to={location.state?.from?.pathname ?? '/'} replace />
  }
  return (
    <div className="auth-shell">
      <Typography.Title level={2} style={{ margin: 0 }}>{t('common.appName')}</Typography.Title>
      <LanguageSwitcher />
      <Outlet />
    </div>
  )
}
