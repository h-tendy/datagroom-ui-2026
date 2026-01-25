import React from 'react';
import styles from './AllDs.module.css';

export default function SearchSortBar({ viewMode, onToggleView, searchText, onSearch, sortBy, onSort }) {
  return (
    <div className={styles.searchBar}>
      <div>
        <input
          className={styles.searchInput}
          placeholder="Search datasets..."
          value={searchText}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
      <div className={styles.controls}>
        <select value={sortBy} onChange={e => onSort(e.target.value)}>
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
          <option value="size_asc">Size ↑</option>
          <option value="size_desc">Size ↓</option>
        </select>
        <button className={styles.viewToggle} onClick={onToggleView}>{viewMode === 'grid' ? 'List' : 'Grid'}</button>
      </div>
    </div>
  );
}
