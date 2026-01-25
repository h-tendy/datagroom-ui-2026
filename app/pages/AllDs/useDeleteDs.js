import { useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useDeleteDs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dsName, dsUser }) => {
      const headers = getAuthHeaders();
      return api('/ds/deleteDs', { method: 'POST', body: { dsName, dsUser }, headers });
    },
    onMutate: async ({ dsName, dsUser }) => {
      await qc.cancelQueries({ queryKey: ['allDs', dsUser] });
      const previous = qc.getQueryData(['allDs', dsUser]);
      if (previous && previous.dbList) {
        qc.setQueryData(['allDs', dsUser], {
          ...previous,
          dbList: previous.dbList.filter(d => d.name !== dsName),
        });
      }
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        qc.setQueryData(['allDs', variables.dsUser], context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      qc.invalidateQueries({ queryKey: ['allDs', variables.dsUser] });
    }
  });
}

export default useDeleteDs;
