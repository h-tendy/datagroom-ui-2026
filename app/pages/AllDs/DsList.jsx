import React from 'react';
import DsCard from './DsCard';
import styles from './AllDs.module.css';

export default function DsList({ dsList = [], viewMode = 'grid', onDeleteRequest }) {
  if (!dsList || dsList.length === 0) return <div className={styles.empty}>No datasets found.</div>;

  return (
    <div className={viewMode === 'grid' ? styles.grid : styles.list}>
      {dsList.map(ds => (
        <DsCard key={ds.name} ds={ds} viewMode={viewMode} onDelete={() => onDeleteRequest(ds)} />
      ))}
    </div>
  );
}
