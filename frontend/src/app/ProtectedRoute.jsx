import { Spin } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

// Chan nguoi chua dang nhap. Dang khoi phuc phien (refresh token) thi hien vong quay thay vi nhay ve trang dang nhap.
export default function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') {
    return <Spin fullscreen />
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}

// Chan theo vai tro (chi UX; server van kiem tra lai).
export function RoleRoute({ roles, children }) {
  const { hasAnyRole } = useAuth()
  return hasAnyRole(roles) ? children : <Navigate to="/403" replace />
}
