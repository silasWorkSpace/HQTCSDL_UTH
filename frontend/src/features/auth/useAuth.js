import { useEffect, useState } from 'react';
import apiClient from '../../services/api/apiClient';

export function useAuth() {
  const [session, setSession] = useState({ user: null, roles: [], loading: true });
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = async () => {
      const requestGeneration = ++generation;
      try {
        const { data } = await apiClient.get('/api/v1/users/me');
        if (!data || typeof data !== 'object' || !Array.isArray(data.roles) || !data.id) {
          throw new Error('Invalid current-user response');
        }
        if (active && requestGeneration === generation) {
          setSession({ user: data, roles: data.roles, loading: false });
        }
      } catch {
        if (active && requestGeneration === generation) setSession({ user: null, roles: [], loading: false });
      }
    };
    refresh();
    window.addEventListener('livingdocs:session-changed', refresh);
    return () => {
      active = false;
      window.removeEventListener('livingdocs:session-changed', refresh);
    };
  }, []);
  return { ...session, role: session.roles[0] || null };
}

export default useAuth;
