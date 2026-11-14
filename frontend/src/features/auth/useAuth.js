import { useState, useEffect } from 'react';

/**
 * Hook quản lý thông tin phiên làm việc và vai trò hiện tại.
 * Đồng bộ với localStorage ('ld_role') và tương thích hoàn toàn với hệ thống quyền của LivingDocs.
 */
export function useAuth() {
  const [role, setRole] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ld_role') || 'Administrator';
    }
    return 'Administrator';
  });

  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem('ld_role');
      if (stored && stored !== role) {
        setRole(stored);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [role]);

  return {
    user: {
      id: 'u-admin-01',
      name: 'System Admin',
      roles: [role, 'Administrator'],
    },
    role,
    roles: [role, 'Administrator'],
  };
}

export default useAuth;
