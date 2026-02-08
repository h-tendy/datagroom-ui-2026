import React from 'react';
import styles from './AddColumnForm.module.css';

/**
 * AddColumnForm - Modal form for adding a new column
 * Reference: reference/common/components/AddColumnForm.js
 * 
 * Props:
 * - columnName: Current value of column name input
 * - position: Current position selection ("left" or "right")
 * - error: Error message to display
 * - onColumnNameChange: Callback when column name changes
 * - onPositionChange: Callback when position changes
 */
function AddColumnForm({ columnName, position, error, onColumnNameChange, onPositionChange }) {
  return (
    <div className={styles.addColumnForm}>
      <div className={styles.formGroup}>
        <label htmlFor="columnName" className={styles.label}>
          Column Name:
        </label>
        <input
          type="text"
          id="columnName"
          className={styles.input}
          value={columnName}
          onChange={(e) => onColumnNameChange(e.target.value)}
          pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
          title="Column name must start with a letter or underscore and contain only alphanumeric characters and underscores"
          placeholder="Enter column name"
          autoFocus
        />
        <small className={styles.hint}>
          Must start with letter or underscore, only alphanumeric and underscores allowed
        </small>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>Position:</label>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="position"
              value="left"
              checked={position === 'left'}
              onChange={(e) => onPositionChange(e.target.value)}
            />
            <span>Left</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="position"
              value="right"
              checked={position === 'right'}
              onChange={(e) => onPositionChange(e.target.value)}
            />
            <span>Right</span>
          </label>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}
    </div>
  );
}

export default AddColumnForm;
