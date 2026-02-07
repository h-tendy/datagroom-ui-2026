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
 */
export function useAddFilter(dsName, dsView, userId) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (filterData) => {
      const { name, description, hdrFilters, hdrSorters, filterColumnAttrs } = filterData;
      
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
      // Refresh view configuration after 500ms (matches reference implementation)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
      }, 500);
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
      // Refresh view configuration after 500ms (matches reference implementation)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
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
      // Refresh view configuration after 500ms (matches reference implementation)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
      }, 500);
    },
  });
}
