import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, FileCode2, CheckSquare, GitPullRequest, History } from 'lucide-react';
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
      label: t('nav.templates') || 'Biểu mẫu',
      path: ROUTES.TEMPLATES,
      icon: <FileCode2 size={18} />,
      roles: ['Technical Lead', 'Manager', 'Administrator'],
    },
    {
      label: 'Hàng đợi duyệt',
      path: ROUTES.REVIEWS,
      icon: <CheckSquare size={18} />,
      roles: ['Staff', 'Manager', 'Administrator'],
    },
    {
      label: 'Gợi ý Drift',
      path: ROUTES.SUGGESTIONS,
      icon: <GitPullRequest size={18} />,
      roles: ['Developer', 'Technical Lead', 'Staff', 'Manager', 'Administrator'],
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
