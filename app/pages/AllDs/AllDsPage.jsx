import React, { useEffect, useMemo, useState } from 'react';
import styles from './AllDs.module.css';
import useAllDs from './useAllDs';
import useDeleteDs from './useDeleteDs';
import SearchSortBar from './SearchSortBar';
import DsList from './DsList';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { useAuth } from '../../auth/AuthProvider';

export default function AllDsPage({ currentUserId }) {
  const auth = useAuth();
  const userId = currentUserId || auth.userId;
  const { data, isLoading, isError, refetch } = useAllDs(userId);
  const deleteMut = useDeleteDs();

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('allDsViewMode') || 'grid');
  const [searchText, setSearchText] = useState(() => localStorage.getItem('allDsSearchText') || '');
  const [sortBy, setSortBy] = useState(() => localStorage.getItem('allDsSortBy') || 'name_asc');
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  useEffect(() => { localStorage.setItem('allDsViewMode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('allDsSearchText', searchText); }, [searchText]);
  useEffect(() => { localStorage.setItem('allDsSortBy', sortBy); }, [sortBy]);

  const dbList = data?.dbList || [];

  const filtered = useMemo(() => {
    const txt = searchText.trim().toLowerCase();
    let out = dbList.filter(d => !txt || (d.name || '').toLowerCase().includes(txt));
    if (sortBy === 'name_asc') out = out.sort((a,b) => (a.name||'').localeCompare(b.name||''));
    if (sortBy === 'name_desc') out = out.sort((a,b) => (b.name||'').localeCompare(a.name||''));
    if (sortBy === 'size_asc') out = out.sort((a,b) => (a.sizeOnDisk||0) - (b.sizeOnDisk||0));
    if (sortBy === 'size_desc') out = out.sort((a,b) => (b.sizeOnDisk||0) - (a.sizeOnDisk||0));
    return out;
  }, [dbList, searchText, sortBy]);

  function handleRequestDelete(ds) { setDeleteCandidate(ds); }
  function handleConfirmDelete() {
    if (!deleteCandidate) return;
    deleteMut.mutate({ dsName: deleteCandidate.name, dsUser: userId });
    setDeleteCandidate(null);
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h3>Datasets</h3>
      </div>
      <SearchSortBar
        viewMode={viewMode}
        onToggleView={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
        searchText={searchText}
        onSearch={setSearchText}
        sortBy={sortBy}
        onSort={setSortBy}
      />

      {isLoading && <div className={styles.loading}>Loading datasets...</div>}
      {isError && (
        <div className={styles.error}>
          Error loading datasets. <button onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {!isLoading && !isError && (
        <DsList
          dsList={filtered}
          viewMode={viewMode}
          onDeleteRequest={handleRequestDelete}
          currentUserId={userId}
        />
      )}

      <ConfirmDeleteModal
        visible={!!deleteCandidate}
        dsName={deleteCandidate?.name}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
