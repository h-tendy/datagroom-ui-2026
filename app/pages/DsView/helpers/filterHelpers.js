/**
 * Filter Helpers
 * 
 * Helper functions for managing saved filters including:
 * - Applying filter column attributes (visibility and widths)
 * - Collecting current filter state from Tabulator
 * 
 * Reference: DsView.js lines 2039-2073, 176-230
 */

/**
 * Apply filter column attributes to Tabulator table
 * Sets column visibility and widths based on saved filter configuration
 * 
 * @param {Object} tabulatorRef - React ref to MyTabulator component
 * @param {Object} filterColumnAttrs - Column attributes from saved filter {field: {hidden: bool, width: number}}
 * @param {boolean} columnResizedRecently - Flag to skip width setting if column was manually resized
 * Reference: DsView.js lines 2039-2073
 */
export function applyFilterColumnAttrs(tabulatorRef, filterColumnAttrs, columnResizedRecently, originalColumnAttrs) {
  if (!tabulatorRef?.table) return;
  
  const cols = tabulatorRef.table.getColumns();
  
  // Helper to get original width for a field whether originalColumnAttrs
  // is an object keyed by field or an array of column defs
  function getOriginalWidth(field) {
    if (!originalColumnAttrs) return undefined;
    // object keyed by field
    if (originalColumnAttrs[field] && originalColumnAttrs[field].width !== undefined) {
      return originalColumnAttrs[field].width;
    }
    // array of column defs
    if (Array.isArray(originalColumnAttrs)) {
      for (let k = 0; k < originalColumnAttrs.length; k++) {
        const c = originalColumnAttrs[k];
        if (c && c.field === field && c.width !== undefined) return c.width;
      }
    }
    return undefined;
  }
  
  // If filterColumnAttrs is empty, show all columns
  if (!filterColumnAttrs || Object.keys(filterColumnAttrs).length === 0) {
    for (let i = 0; i < cols.length; i++) {
      const field = cols[i].getField();
      if (!cols[i].isVisible()) {
        cols[i].show();
      }

      // Restore original width if provided and column wasn't manually resized
      try {
        const origW = getOriginalWidth(field);
        if (origW !== undefined && !columnResizedRecently) {
          cols[i].setWidth(origW);
        }
      } catch (e) {
        // ignore width setting errors
      }
    }
    return;
  }
  
  // Apply filter column attributes
  for (let i = 0; i < cols.length; i++) {
    const field = cols[i].getField();
    const attrsForField = filterColumnAttrs[field];
    
      if (attrsForField) {
      // Apply visibility
      if (attrsForField.hidden) {
        cols[i].hide();
      } else {
        if (!cols[i].isVisible()) {
          cols[i].show();
        }
      }
      
      // Apply width (skip if column was manually resized recently)
        if (!columnResizedRecently) {
          if (attrsForField.width !== undefined) {
            try { cols[i].setWidth(attrsForField.width); } catch (e) {}
          } else {
            const origW = getOriginalWidth(field);
            if (origW !== undefined) {
              try { cols[i].setWidth(origW); } catch (e) {}
            }
          }
        }
    }
  }
}

/**
 * Collect current filter state from Tabulator table
 * Gathers header filters, sorters, and column attributes for saving
 * 
 * @param {Object} tabulatorRef - React ref to MyTabulator component
 * @returns {Object} Filter state {hdrFilters, hdrSorters, filterColumnAttrs}
 * Reference: DsView.js lines 176-230 (FilterControls save logic)
 */
export function collectCurrentFilterState(tabulatorRef) {
  if (!tabulatorRef?.table) {
    return {
      hdrFilters: [],
      hdrSorters: [],
      filterColumnAttrs: {}
    };
  }
  
  // Collect header filters - sanitize to remove circular references
  const hdrFiltersTmp = tabulatorRef.table.getHeaderFilters();
  const hdrFilters = [];
  for (let i = 0; i < hdrFiltersTmp.length; i++) {
    const hf = hdrFiltersTmp[i];
    hdrFilters.push({
      field: hf.field,
      value: hf.value,
      type: hf.type
    });
  }
  
  // Collect sorters
  const hdrSortersTmp = tabulatorRef.table.getSorters();
  const hdrSorters = [];
  for (let i = 0; i < hdrSortersTmp.length; i++) {
    hdrSorters.push({
      column: hdrSortersTmp[i].field,
      dir: hdrSortersTmp[i].dir
    });
  }
  
  // Collect column visibility and width attributes
  const filterColumnAttrs = {};
  const cols = tabulatorRef.table.getColumns();
  for (let i = 0; i < cols.length; i++) {
    const field = cols[i].getField();
    const attrsForField = {};
    
    if (!cols[i].isVisible()) {
      attrsForField.hidden = true;
    }
    
    attrsForField.width = cols[i].getWidth();
    filterColumnAttrs[field] = attrsForField;
  }
  
  return {
    hdrFilters,
    hdrSorters,
    filterColumnAttrs
  };
}

/**
 * Helper to create filter helper context for DsView components
 */
export default function createFilterHelpers(context) {
  const { ref } = context;
  
  return {
    applyFilterColumnAttrs: (filterColumnAttrs, columnResizedRecently) => {
      const tabulatorRef = typeof ref === 'function' ? ref() : ref;
      return applyFilterColumnAttrs(tabulatorRef, filterColumnAttrs, columnResizedRecently);
    },
    
    collectCurrentFilterState: () => {
      const tabulatorRef = typeof ref === 'function' ? ref() : ref;
      return collectCurrentFilterState(tabulatorRef);
    }
  };
}
