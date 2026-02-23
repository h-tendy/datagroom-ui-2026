/**
 * Filter Mutation Hooks
 * 
 * React Query mutation hooks for filter CRUD operations
 * Reference: DsView.js + FilterControls.js filter save/edit/delete logic
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addFilter, editFilter, deleteFilter } from '../api/ds.js';

/**
 * Hook to add a new filter
 * Reference: FilterControls.js lines 177-278 (saveAsNew logic)
 * 
 * Like the reference implementation, this triggers a delayed refetch (500ms) to allow
 * the backend to process, but resolves immediately so navigation can happen right away.
 * React Query will update the component when the refetch completes.
 */
export function useAddFilter(dsName, dsView, userId) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (filterData) => {
      const { name, description, hdrFilters, hdrSorters, filterColumnAttrs} = filterData;
      
      return addFilter({
        dsName,
        dsView,
        dsUser: userId,
        filter: {
          name,
          description,
          hdrFilters,
          hdrSorters,
          filterColumnAttrs,
        },
      });
    },
    onSuccess: () => {
      console.log('[ADD-FILTER] Success! Scheduling refetch in 500ms for:', dsName, dsView, userId);
      // Trigger a delayed refetch like the reference implementation (500ms)
      // This allows the backend to process the new filter before we fetch the updated config
      // Use refetchQueries instead of invalidateQueries to force an immediate refetch
      setTimeout(() => {
        console.log('[ADD-FILTER] Triggering refetch NOW');
        queryClient.refetchQueries({ queryKey: ['dsView', dsName, dsView, userId] }).then(() => {
          console.log('[ADD-FILTER] Refetch completed');
        });
      }, 500);
      // Note: We don't await here - navigation happens immediately
      // React Query will update components when the refetch completes
    },
  });
}

/**
 * Hook to edit an existing filter
 * Reference: FilterControls.js lines 74-175 (save logic)
 */
export function useEditFilter(dsName, dsView, userId) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (filterData) => {
      const { name, description, hdrFilters, hdrSorters, filterColumnAttrs } = filterData;
      
      return editFilter({
        dsName,
        dsView,
        dsUser: userId,
        filter: {
          name,
          description,
          hdrFilters,
          hdrSorters,
          filterColumnAttrs,
        },
      });
    },
    onSuccess: () => {
      // Trigger delayed refetch
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['dsView', dsName, dsView, userId] });
      }, 500);
    },
  });
}

/**
 * Hook to delete a filter
 * Reference: FilterControls.js lines 30-72 (delete logic)
 */
export function useDeleteFilter(dsName, dsView, userId) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (filterName) => {
      return deleteFilter({
        dsName,
        dsView,
        dsUser: userId,
        filter: {
          name: filterName,
        },
      });
    },
    onSuccess: () => {
      // Trigger delayed refetch
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['dsView', dsName, dsView, userId] });
      }, 500);
    },
  });
}
