import React from 'react';
import { Link } from 'react-router-dom';
import styles from './AllDs.module.css';

export default function DsCard({ ds, viewMode, onDelete, currentUserId, allInfoExpanded }) {
  const owner = ds?.perms?.owner || null;
  const size = ds?.sizeOnDisk ? `${Math.round(ds.sizeOnDisk / 1024)} KB` : '—';
  const isOwner = owner && currentUserId && String(owner).toLowerCase() === String(currentUserId).toLowerCase();

  const [perCardExpanded, setPerCardExpanded] = React.useState(null); // null = follow global
  const expanded = perCardExpanded !== null ? perCardExpanded : !!allInfoExpanded;

  // When global toggle changes, enforce it on per-card state (but allow later per-card overrides)
  React.useEffect(() => {
    setPerCardExpanded(allInfoExpanded);
  }, [allInfoExpanded]);

  function toggleCard() {
    setPerCardExpanded(prev => (prev === null ? !expanded : !prev));
  }

  return (
    <div className={viewMode === 'grid' ? styles.card : styles.cardList}>
      <div className={styles.cardBody}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className={styles.cardTitle}>{ds.name}</div>
          <i
            className={`fa fa-info-circle ${styles.cardInfoIcon} ${expanded ? styles.iconActive : ''}`}
            onClick={toggleCard}
            role="button"
            aria-pressed={expanded}
            title={expanded ? 'Hide info' : 'Show info'}
          />
        </div>

        {expanded ? (
          <>
            <div className={styles.cardMeta}>Owner: {owner || '—'}</div>
            <div className={styles.cardMeta}>Size: {size}</div>
          </>
        ) : (
          <div style={{ height: 6 }} />
        )}
      </div>
      <div className={styles.cardActions}>
        <Link to={`/ds/${encodeURIComponent(ds.name)}`} className={styles.openLink}>Open</Link>
        {isOwner && (
          <button className={styles.deleteBtn} onClick={onDelete}>Delete</button>
        )}
      </div>
    </div>
  );
}
