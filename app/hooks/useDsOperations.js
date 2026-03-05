import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insertRow, deleteRow, deleteManyRows, addColumn, deleteColumn } from '../api/ds.js';

/**
 * Hook to insert a new row
 * Note: Does not invalidate queries - component updates row with backend _id directly
 * to avoid full table reload and preserve scroll position
 */
export function useInsertRow(dsName, dsView, userId) {
  // Don't use queryClient - component handles row update with _id manually
  return useMutation({
    mutationFn: (rowData) => insertRow(rowData),
    // No onSuccess handler - component will update row with _id directly
  });
}

/**
 * Hook to delete a single row
 * Note: Does not invalidate queries - caller should handle row removal from Tabulator
 * to avoid full table reload and preserve scroll position
 */
export function useDeleteRow(dsName, dsView, userId) {
  // Don't use queryClient - we handle row removal manually in the component
  return useMutation({
    mutationFn: (deleteData) => deleteRow(deleteData),
    // No onSuccess handler - component will call row.delete() directly
  });
}

/**
 * Hook to delete multiple rows
 * Note: Does not invalidate queries - caller should handle row removal from Tabulator
 * to avoid full table reload and preserve scroll position
 */
export function useDeleteManyRows(dsName, dsView, userId) {
  // Don't use queryClient - we handle row removal manually in the component
  return useMutation({
    mutationFn: (deleteData) => deleteManyRows(deleteData),
    // No onSuccess handler - component will call table.clearData() or row.delete() directly
  });
}

/**
 * Hook to add a new column
 */
export function useAddColumn(dsName, dsView, userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (columnData) => addColumn(columnData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
    },
  });
}

/**
 * Hook to delete a column
 */
export function useDeleteColumn(dsName, dsView, userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deleteData) => deleteColumn(deleteData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
    },
  });
}

export default {
  useInsertRow,
  useDeleteRow,
  useDeleteManyRows,
  useAddColumn,
  useDeleteColumn,
};
