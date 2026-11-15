import { createBrowserRouter } from 'react-router-dom'
import ForbiddenPage from '../features/errors/ForbiddenPage'
import NotFoundPage from '../features/errors/NotFoundPage'
import LoginPage from '../features/auth/LoginPage'
import RegisterPage from '../features/auth/RegisterPage'
import AppLayout from '../layouts/AppLayout'
import AuthLayout from '../layouts/AuthLayout'
import ProtectedRoute, { RoleRoute } from './ProtectedRoute'
import { APP_ROUTES } from './routes'

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          ...APP_ROUTES.map(({ path, roles, Component }) => ({
            path,
            element: (
              <RoleRoute roles={roles}>
                <Component />
              </RoleRoute>
            ),
          })),
          { path: '/403', element: <ForbiddenPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
