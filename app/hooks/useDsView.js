import { useQuery } from '@tanstack/react-query';
import { fetchViewColumns } from '../api/ds.js';

/**
 * Hook to fetch dataset view configuration including columns, keys, JIRA config, filters
 * @param {string} dsName - Dataset name
 * @param {string} dsView - View name
 * @param {string} userId - User ID
 * @returns {Object} React Query result with view configuration data
 */
export function useDsView(dsName, dsView, userId) {
  return useQuery({
    queryKey: ['dsView', dsName, dsView, userId],
    queryFn: () => fetchViewColumns(dsName, dsView, userId),
    enabled: !!(dsName && dsView && userId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}

export default useDsView;
