import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

function getAuthHeaders() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return {};
    const u = JSON.parse(raw);
    if (u && u.token) return { authorization: 'Bearer ' + u.token };
  } catch (e) {
    // ignore
  }
  return {};
}

export function useAllDs(userId) {
  return useQuery({
    queryKey: ['allDs', userId],
    queryFn: async () => {
      const headers = getAuthHeaders();
      const data = await api(`/ds/dsList/${userId}`, { method: 'GET', headers });
      return data;
    },
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 minute
  });
}

export default useAllDs;
