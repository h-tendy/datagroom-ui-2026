import { useMutation, useQueryClient } from '@tanstack/react-query';
import { editCell } from '../api/ds.js';

/**
 * Hook to edit a single cell value with optimistic updates
 * @param {string} dsName - Dataset name
 * @param {string} dsView - View name
 * @param {string} userId - User ID
 * @returns {Object} React Query mutation result
 */
export function useEditCell(dsName, dsView, userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (editData) => editCell(editData),
    onMutate: async (editData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['dsView', dsName, dsView, userId] });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData(['dsView', dsName, dsView, userId]);

      // Optimistically update - this could be enhanced to update cached table data
      // For now, we'll let the socket or manual refresh handle the update

      return { previousData };
    },
    onError: (err, editData, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['dsView', dsName, dsView, userId], context.previousData);
      }
    },
    onSuccess: (data, editData) => {
      // Invalidate to refetch fresh data
      // Note: In the original implementation, socket events would trigger updates
      // queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
    },
  });
}

export default useEditCell;
