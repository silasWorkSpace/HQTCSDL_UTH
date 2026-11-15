import { Suspense, useMemo, useState } from 'react'
import { Badge, Button, Dropdown, Layout, Menu, Space, Spin, Tag } from 'antd'
import { BellOutlined, UserOutlined } from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { APP_ROUTES } from '../app/routes'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { useAuth } from '../features/auth/useAuth'
import { useUnreadCount } from '../features/notifications/useUnreadCount'

const { Header, Sider, Content } = Layout

// Khung chinh: menu ben trai theo vai tro, header co ngon ngu, chuong thong bao, menu nguoi dung.
// Duoi 992 px (tablet tro xuong) menu tu thu gon, bam nut o mep de mo (NFR-USAB-01).
export default function AppLayout() {
  const { t } = useTranslation()
  const { user, logout, hasAnyRole } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: unread = 0 } = useUnreadCount()
  const [collapsed, setCollapsed] = useState(false)

  const menuItems = useMemo(
    () =>
      APP_ROUTES.filter((route) => route.showInMenu !== false && hasAnyRole(route.roles)).map((route) => ({
        key: route.path,
        icon: route.icon,
        label: t(route.labelKey),
      })),
    [hasAnyRole, t],
  )

  const selectedKey = useMemo(() => {
    const match = APP_ROUTES.filter((route) => route.path !== '/' && pathname.startsWith(route.path)).sort(
      (a, b) => b.path.length - a.path.length,
    )[0]
    return match ? match.path : '/'
  }, [pathname])

  const userMenu = {
    items: [
      { key: 'profile', label: t('nav.profile') },
      { key: 'logout', label: t('common.actions.logout'), danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'profile') navigate('/profile')
      if (key === 'logout') logout()
    },
  }

  return (
    <Layout style={{ minHeight: '100%' }}>
      <Sider
        theme="dark"
        width={240}
        breakpoint="lg"
        collapsedWidth={0}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
      >
        <div className="app-brand">{t('common.appName')}</div>
        <Menu
          theme="dark"
          mode="inline"
          items={menuItems}
          selectedKeys={[selectedKey]}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Space size="small" wrap>
            <Tag>{user?.tenant}</Tag>
            {user?.roles.map((role) => (
              <Tag key={role} color="blue">{t(`common.role.${role}`)}</Tag>
            ))}
          </Space>
          <LanguageSwitcher />
          <Badge count={unread} size="small">
            <Button
              type="text"
              icon={<BellOutlined />}
              aria-label={t('nav.notifications')}
              onClick={() => navigate('/notifications')}
            />
          </Badge>
          <Dropdown menu={userMenu} trigger={['click']}>
            <Button type="text" icon={<UserOutlined />}>{user?.email}</Button>
          </Dropdown>
        </Header>
        <Content className="app-content">
          <Suspense fallback={<Spin />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  )
}
