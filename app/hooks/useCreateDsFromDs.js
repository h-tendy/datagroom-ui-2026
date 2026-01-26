import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDsFromDs } from '../api/ds';

export default function useCreateDsFromDs() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (payload) => {
      return createDsFromDs(payload);
    },
    onSuccess: (res, variables) => {
      if (res && res.ok) {
        // invalidate allDs queries for the user to refresh list
        const userId = variables.dsUser;
        if (userId) qc.invalidateQueries(['allDs', userId]);
        else qc.invalidateQueries(['allDs']);
      }
    }
  });

  return m;
}
