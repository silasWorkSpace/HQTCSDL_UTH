import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppLayout({ children, activeRole, onRoleChange, showSidebar = false }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--ld-bg-subtle)' }}>
      <Header activeRole={activeRole} onRoleChange={onRoleChange} />
      <div style={{ display: 'flex', flex: 1 }}>
        {showSidebar && <Sidebar activeRole={activeRole} />}
        <main style={{ flex: 1, padding: '24px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
