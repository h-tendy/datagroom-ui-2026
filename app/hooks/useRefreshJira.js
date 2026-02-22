import { useMutation } from '@tanstack/react-query';
import { refreshJira } from '../api/ds.js';

export function useRefreshJira(dsName, dsView, userId) {
  return useMutation({
    mutationFn: (refreshData) => refreshJira(refreshData),
  });
}

export default useRefreshJira;
