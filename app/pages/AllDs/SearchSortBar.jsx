import React from 'react';
import styles from './AllDs.module.css';

export default function SearchSortBar({ viewMode, onToggleView, searchText, onSearch, sortBy, onSort }) {
  return (
    <div className={styles.searchBar}>
      <div className={styles.controls} style={{ marginLeft: 'auto' }}>
        <i
          className={`fa ${viewMode === 'grid' ? 'fa-th' : 'fa-list'} ${viewMode === 'grid' ? styles.iconActive : ''} ${styles.viewIcon}`}
          onClick={onToggleView}
          role="button"
          aria-pressed={viewMode === 'grid'}
          title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
        />

        <span className={styles.searchWrap}>
          <i className={`fa fa-search ${styles.searchIcon}`} aria-hidden="true" />
          <input
            className={styles.searchInput}
            placeholder="Search datasets..."
            value={searchText}
            onChange={e => onSearch(e.target.value)}
            aria-label="Search datasets"
          />
        </span>

        <select value={sortBy} onChange={e => onSort(e.target.value)}>
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
          <option value="size_asc">Size ↑</option>
          <option value="size_desc">Size ↓</option>
        </select>
      </div>
    </div>
  );
}
