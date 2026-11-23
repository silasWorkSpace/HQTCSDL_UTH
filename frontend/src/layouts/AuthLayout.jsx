import React from 'react';
import { FileCode2 } from 'lucide-react';

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--ld-border)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          padding: '32px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'var(--ld-primary-light)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ld-primary)',
              marginBottom: '12px',
            }}
          >
            <FileCode2 size={28} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--ld-text)' }}>
            {title || 'LivingDocs'}
          </h1>
          {subtitle && (
            <p style={{ fontSize: '14px', color: 'var(--ld-text-secondary)', margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
