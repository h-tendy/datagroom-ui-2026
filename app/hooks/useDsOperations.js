import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insertRow, deleteRow, deleteManyRows, addColumn, deleteColumn } from '../api/ds.js';

/**
 * Hook to insert a new row
 */
export function useInsertRow(dsName, dsView, userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rowData) => insertRow(rowData),
    onSuccess: () => {
      // Invalidate to show new row
      queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
    },
  });
}

/**
 * Hook to delete a single row
 */
export function useDeleteRow(dsName, dsView, userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deleteData) => deleteRow(deleteData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
    },
  });
}

/**
 * Hook to delete multiple rows
 */
export function useDeleteManyRows(dsName, dsView, userId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deleteData) => deleteManyRows(deleteData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
    },
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
