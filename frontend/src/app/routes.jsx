import { lazy } from 'react'
import {
  AuditOutlined,
  BulbOutlined,
  FileTextOutlined,
  GithubOutlined,
  HomeOutlined,
  LayoutOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { ROLES } from '../constants/roles'

const { DEVELOPER, STAFF, MANAGER, TECH_LEAD, ADMINISTRATOR } = ROLES

// MOT NOI DUY NHAT khai bao man hinh cua ung dung: vua sinh route, vua sinh menu ben trai.
// Nguoi khac thay trang giu cho bang trang that trong features/<ten>/ (giu nguyen path, roles, labelKey).
//   roles: de trong = moi vai tro da dang nhap. showInMenu: false = chi co route, khong hien o menu.
// Quyen o day chi de an/hien giao dien. Server moi la noi quyet dinh (NFR-SEC-02).
export const APP_ROUTES = [
  { path: '/', labelKey: 'nav.home', icon: <HomeOutlined />, Component: lazy(() => import('../features/home/HomePage')) },
  {
    path: '/repositories',
    labelKey: 'nav.repositories',
    icon: <GithubOutlined />,
    roles: [DEVELOPER],
    Component: lazy(() => import('../features/repositories/RepositoriesPage')),
  },
  {
    path: '/documents',
    labelKey: 'nav.documents',
    icon: <FileTextOutlined />,
    roles: [DEVELOPER, STAFF, MANAGER, TECH_LEAD],
    Component: lazy(() => import('../features/documents/DocumentsPage')),
  },
  {
    path: '/suggestions',
    labelKey: 'nav.suggestions',
    icon: <BulbOutlined />,
    roles: [DEVELOPER],
    Component: lazy(() => import('../features/suggestions/SuggestionsPage')),
  },
  {
    path: '/reviews',
    labelKey: 'nav.reviews',
    icon: <AuditOutlined />,
    roles: [STAFF, MANAGER],
    Component: lazy(() => import('../features/reviews/ReviewQueuePage')),
  },
  {
    path: '/templates',
    labelKey: 'nav.templates',
    icon: <LayoutOutlined />,
    roles: [TECH_LEAD],
    Component: lazy(() => import('../features/templates/TemplatesPage')),
  },
  {
    path: '/search',
    labelKey: 'nav.search',
    icon: <SearchOutlined />,
    Component: lazy(() => import('../features/knowledge/KnowledgeSearchPage')),
  },
  {
    path: '/admin/users',
    labelKey: 'nav.adminUsers',
    icon: <TeamOutlined />,
    roles: [ADMINISTRATOR],
    Component: lazy(() => import('../features/admin/AdminUsersPage')),
  },
  {
    path: '/notifications',
    labelKey: 'nav.notifications',
    showInMenu: false,
    Component: lazy(() => import('../features/notifications/NotificationsPage')),
  },
  {
    path: '/profile',
    labelKey: 'nav.profile',
    showInMenu: false,
    Component: lazy(() => import('../features/profile/ProfilePage')),
  },
]
