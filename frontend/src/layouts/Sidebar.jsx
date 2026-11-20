import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, CheckSquare, Activity, Shield, LayoutTemplate, BarChart3 } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { ROUTES } from '../constants/routes';

export default function Sidebar({ activeRole }) {
  const { t } = useI18n();
  const location = useLocation();

  const navItems = [
    {
      label: t('nav.documents') || 'Tài liệu',
      path: ROUTES.DOCUMENTS,
      icon: <FileText size={18} />,
      roles: ['Developer', 'Technical Lead', 'Staff', 'Manager', 'Administrator'],
    },
    {
      label: 'Hàng đợi duyệt',
      path: ROUTES.REVIEWS,
      icon: <CheckSquare size={18} />,
      roles: ['Staff', 'Manager', 'Administrator'],
    },
    {
      label: 'Gợi ý drift',
      path: '/suggestions',
      icon: <Activity size={18} />,
      roles: ['Developer', 'Administrator'],
    },
    {
      label: 'Lịch sử drift',
      path: '/drift-history',
      icon: <Activity size={18} />,
      roles: ['Developer', 'Administrator'],
    },
    {
      label: 'Mẫu tài liệu',
      path: ROUTES.TEMPLATES,
      icon: <LayoutTemplate size={18} />,
      roles: ['Technical Lead', 'Manager', 'Administrator'],
    },
    {
      label: 'Sức khỏe tài liệu',
      path: ROUTES.GOVERNANCE_DASHBOARD,
      icon: <BarChart3 size={18} />,
      roles: ['Technical Lead', 'Manager', 'Administrator'],
    },
    {
      label: 'Chính sách quản trị',
      path: ROUTES.GOVERNANCE_POLICIES,
      icon: <Shield size={18} />,
      roles: ['Technical Lead', 'Manager', 'Administrator'],
    },
  ];

  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(activeRole));

  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid var(--ld-border)',
        minHeight: 'calc(100vh - 60px)',
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {visibleItems.map((item) => {
        const isActive = location.pathname.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--ld-primary)' : 'var(--ld-text-secondary)',
              backgroundColor: isActive ? 'var(--ld-primary-light)' : 'transparent',
              transition: 'background-color 0.15s ease',
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
