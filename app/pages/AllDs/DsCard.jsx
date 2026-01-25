import React from 'react';
import { Link } from 'react-router-dom';
import styles from './AllDs.module.css';

export default function DsCard({ ds, viewMode, onDelete }) {
  const owner = ds?.perms?.owner || '—';
  const size = ds?.sizeOnDisk ? `${Math.round(ds.sizeOnDisk / 1024)} KB` : '—';

  return (
    <div className={viewMode === 'grid' ? styles.card : styles.cardList}>
      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>{ds.name}</div>
        <div className={styles.cardMeta}>Owner: {owner}</div>
        <div className={styles.cardMeta}>Size: {size}</div>
      </div>
      <div className={styles.cardActions}>
        <Link to={`/ds/${encodeURIComponent(ds.name)}`} className={styles.openLink}>Open</Link>
        <button className={styles.deleteBtn} onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
