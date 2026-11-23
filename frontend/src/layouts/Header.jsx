import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, FileCode2, Globe, Shield } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { SYSTEM_ROLES } from '../constants/roles';

export default function Header({ activeRole, onRoleChange }) {
  const { t, lang, setLang } = useI18n();
  const location = useLocation();

  const isDocs = location.pathname.startsWith('/documents') || location.pathname === '/';
  const isTemplates = location.pathname.startsWith('/templates');

  return (
    <header
      style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--ld-border)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0 20px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link
            to="/documents"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--ld-primary)',
              fontWeight: 700,
              fontSize: '18px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--ld-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ld-primary)',
              }}
            >
              <FileCode2 size={20} />
            </div>
            LivingDocs
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to="/documents"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                color: isDocs ? 'var(--ld-primary)' : 'var(--ld-text-secondary)',
                backgroundColor: isDocs ? 'var(--ld-primary-light)' : 'transparent',
              }}
            >
              <FileText size={16} />
              {t('nav.documents')}
            </Link>

            <Link
              to="/templates"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
                color: isTemplates ? 'var(--ld-primary)' : 'var(--ld-text-secondary)',
                backgroundColor: isTemplates ? 'var(--ld-primary-light)' : 'transparent',
              }}
            >
              <FileCode2 size={16} />
              {t('nav.templates')}
            </Link>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              backgroundColor: '#f1f5f9',
              padding: '6px 12px',
              borderRadius: '20px',
              color: 'var(--ld-text-secondary)',
            }}
          >
            <Shield size={14} color="var(--ld-primary)" />
            <span>{t('roles.active')}:</span>
            <select
              value={activeRole}
              onChange={(e) => onRoleChange && onRoleChange(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontWeight: 600,
                color: 'var(--ld-text)',
                cursor: 'pointer',
                outline: 'none',
                fontSize: '13px',
              }}
            >
              {SYSTEM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderLeft: '1px solid var(--ld-border)',
              paddingLeft: '12px',
            }}
          >
            <Globe size={15} color="var(--ld-text-muted)" />
            <button
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              style={{
                border: '1px solid var(--ld-border)',
                backgroundColor: '#ffffff',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--ld-text)',
              }}
            >
              {lang.toUpperCase()}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
