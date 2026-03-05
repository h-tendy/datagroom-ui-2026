# Table Operations Design - React Query Migration

## Overview

This document describes the design decisions and implementation details for table row operations (add, delete, duplicate) in the DsView component after migrating from Redux to React Query.

**Core Problem**: React Query's automatic query invalidation was causing unnecessary table reloads, losing scroll position and column widths, creating a poor user experience compared to the old Redux implementation.

**Core Solution**: Handle all UI updates locally using Tabulator's API methods, without invalidating React Query caches. This preserves scroll position, column widths, and provides instant feedback.

---

## Key Design Principles

### 1. No Query Invalidation for Row Operations
**Why**: Invalidating queries triggers a full table reload from the server, which:
- Resets scroll position (both browser window and table internal scroll)
- Loses column width adjustments
- Creates visual flicker
- Adds unnecessary server load

**How**: Custom mutation hooks that do NOT call `queryClient.invalidateQueries()` in their `onSuccess` handlers.

### 2. Local UI Updates Using Tabulator API
**Pattern**: After successful backend operation, update Tabulator directly:
- **Row addition**: Tabulator handles via `rowAdded` callback when backend returns `_id`
- **Single row deletion**: Call `tabulatorRow.delete()` directly
- **Mass deletion**: Call `table.clearData()` to show empty table
- **Row update**: Call `tabulatorRow.update(data)` directly

### 3. Dual Scroll Preservation
**Critical Insight**: There are TWO independent scroll positions that must be preserved:
1. **Browser window scroll** (`window.scrollY`, `window.scrollX`)
2. **Table internal scroll** (`rowManager.scrollTop`, `rowManager.scrollLeft`)

Both must be captured BEFORE the operation and restored AFTER, or the user loses their place.

---

## Implemented Fixes

### Fix 1: Filter Column Width Preservation
**Problem**: When saving a filter immediately after adjusting column widths, the table would reload and lose the width changes.

**Solution**:
- Track `viewConfig` changes using hash comparison
- When `viewConfig` changes from backend, derive fresh `filterColumnAttrs` in useEffect
- This ensures saved column widths are applied to the loaded filter

**Files Modified**:
- `app/pages/DsView/DsViewPage.jsx`: Added viewConfig tracking and effect to sync attrs

---

### Fix 2: Single Row Deletion Without Reload
**Problem**: Deleting a single row triggered a full table reload, losing scroll position.

**Solution**:
- Modified `useDeleteRow` hook to NOT invalidate queries
- Pass Tabulator row object through to `handleDeleteRow`
- Call `tabulatorRow.delete()` directly after successful backend deletion
- Added scroll preservation (see Fix 5)

**Files Modified**:
- `app/hooks/useDsOperations.js`: Removed query invalidation from `useDeleteRow`
- `app/pages/DsView/DsViewPage.jsx`: Modified `handleDeleteRow` to accept row object, call `row.delete()`

**Code Pattern**:
```javascript
// In hook - NO invalidation
export function useDeleteRow(dsName, dsView, userId) {
  return useMutation({
    mutationFn: (deleteData) => deleteRow(deleteData),
    // No onSuccess handler - component handles row removal
  });
}

// In component - direct row removal
await deleteRowMutation.mutateAsync(deleteData);
tabulatorRow.delete(); // Remove from table directly
```

---

### Fix 3: Row Addition Without Reload
**Problem**: Adding a row (via duplication) triggered a full table reload.

**Solution**:
- Modified `useInsertRow` hook to NOT invalidate queries
- Let Tabulator handle row addition via `rowAdded` callback
- Backend returns `_id`, which component updates into the row data
- Row updates with new `_id`, triggering `rowAdded` callback
- Added scroll preservation (see Fix 5)

**Files Modified**:
- `app/hooks/useDsOperations.js`: Removed query invalidation from `useInsertRow`
- `app/pages/DsView/DsViewPage.jsx`: Check `result.status === 'success'` first, then use `result._id`

**Code Pattern**:
```javascript
// In hook - NO invalidation
export function useInsertRow(dsName, dsView, userId) {
  return useMutation({
    mutationFn: (rowData) => insertRow(rowData),
    // No onSuccess handler - component updates row with _id
  });
}

// In component - update row with _id
const result = await insertRowMutation.mutateAsync(rowData);
if (result.status === 'success' && result._id) {
  tabulatorRow.update({ ...rowData, _id: result._id });
  // Triggers rowAdded callback which restores scroll
}
```

---

### Fix 4: Background Color Removal After Row Save
**Problem**: After successfully adding a row, the temporary background color highlighting the new row wasn't being removed.

**Root Cause**: Code was checking `if (result._id)` before checking `if (result.status === 'success')`. Since `result._id` was undefined on the first check, the code path that removes the background color never executed.

**Solution**:
- Check `result.status === 'success'` FIRST
- Then access `result._id`
- Remove background color after successful save

**Files Modified**:
- `app/pages/DsView/DsViewPage.jsx`: Reordered conditional checks in `handleAddRow`

---

### Fix 5: Browser Window Scroll Preservation
**Problem**: Both row duplication and deletion were losing browser window scroll position, causing the view to jump to the top.

**Root Cause**: Operations were only preserving Tabulator's internal scroll (`rowManager.scrollTop`), but NOT the browser window scroll (`window.scrollY`).

**Solution**:
- Capture BOTH scroll positions in context menu action handlers (before operation starts)
- Store in `scrollPositionBeforeLoadRef.current`:
  ```javascript
  {
    scrollTop: tabulatorRef.current.rowManager.scrollTop,
    scrollLeft: tabulatorRef.current.rowManager.scrollLeft,
    windowScrollY: window.scrollY,
    windowScrollX: window.scrollX
  }
  ```
- Restore BOTH scroll positions in callbacks using `requestAnimationFrame`:
  ```javascript
  requestAnimationFrame(() => {
    window.scrollTo(scrollX, scrollY);
    // Also restore table internal scroll
  });
  ```

**Files Modified**:
- `app/pages/DsView/helpers/tabulatorConfig.js`: 
  - Lines 196-227: "Add row above/below" actions capture scroll
  - Lines 228-247: "Delete row" action captures scroll
- `app/pages/DsView/DsViewPage.jsx`:
  - Lines 2056-2066: `handleDeleteRow` restores window scroll after deletion
  - Lines 2498-2506: `duplicateAndAddRowHandler` restores window scroll after addition
  - Lines 3058-3088: `rowAdded` callback restores both scrolls
  - Lines 3089-3111: `rowDeleted` callback restores both scrolls

**Critical Pattern**:
```javascript
// CAPTURE in context menu (BEFORE operation)
const captureScroll = () => {
  scrollPositionRef.current = {
    scrollTop: tabulatorRef.current?.rowManager?.scrollTop || 0,
    scrollLeft: tabulatorRef.current?.rowManager?.scrollLeft || 0,
    windowScrollY: window.scrollY || 0,
    windowScrollX: window.scrollX || 0
  };
};

// RESTORE in callback (AFTER operation)
const restoreScroll = () => {
  const savedScroll = scrollPositionBeforeLoadRef.current;
  if (savedScroll && (savedScroll.windowScrollY || savedScroll.windowScrollX)) {
    requestAnimationFrame(() => {
      window.scrollTo(savedScroll.windowScrollX || 0, savedScroll.windowScrollY || 0);
    });
  }
  // Also restore table internal scroll
  if (savedScroll && 'scrollTop' in savedScroll) {
    tabulatorRef.current.rowManager.scrollTop = savedScroll.scrollTop;
    tabulatorRef.current.rowManager.scrollLeft = savedScroll.scrollLeft;
  }
};
```

---

### Fix 6: Mass Deletion Operations Leave Table Empty
**Problem**: Both "Delete all rows in view" and "Delete all rows in query" were calling `table.setData()` after deletion, which triggered a full table reload from the server.

**Desired Behavior**: After mass deletion, leave the table empty (showing no rows) while preserving filter configuration. This confirms to the user that all rows were deleted without losing their filter context.

**Solution**:
- Replace `table.setData()` with `table.clearData()` in success handlers
- Modified `useDeleteManyRows` hook to NOT invalidate queries

**Files Modified**:
- `app/pages/DsView/DsViewPage.jsx`:
  - Line ~1167: `deleteAllRowsInQuery` - replaced `setData()` with `clearData()`
  - Line ~1231: `deleteAllRowsInView` - replaced `setData()` with `clearData()`
- `app/hooks/useDsOperations.js`: Removed query invalidation from `useDeleteManyRows`

**Code Pattern**:
```javascript
// SUCCESS HANDLER - clear table locally
onSuccess: () => {
  setShowModal(false);
  setNotificationMessage('Delete completed');
  // Clear table locally - no server refresh
  try {
    if (tabulatorRef.current?.table?.clearData) {
      tabulatorRef.current.table.clearData();
    }
  } catch (e) {
    console.error(e);
  }
}

// HOOK - no query invalidation
export function useDeleteManyRows(dsName, dsView, userId) {
  return useMutation({
    mutationFn: (deleteData) => deleteManyRows(deleteData),
    // No onSuccess handler - component handles UI update
  });
}
```

---

## Architecture Details

### Modified Hooks (useDsOperations.js)

All row operation hooks follow the same pattern: no query invalidation.

```javascript
// ✅ CORRECT - No invalidation
export function useInsertRow(dsName, dsView, userId) {
  return useMutation({
    mutationFn: (rowData) => insertRow(rowData),
  });
}

export function useDeleteRow(dsName, dsView, userId) {
  return useMutation({
    mutationFn: (deleteData) => deleteRow(deleteData),
  });
}

export function useDeleteManyRows(dsName, dsView, userId) {
  return useMutation({
    mutationFn: (deleteData) => deleteManyRows(deleteData),
  });
}

// ❌ WRONG - Would cause table reload
export function useDeleteRow(dsName, dsView, userId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deleteData) => deleteRow(deleteData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
    },
  });
}
```

### Scroll Preservation Flow

```
1. USER ACTION
   └─> Context menu opened
       └─> User clicks "Delete" or "Duplicate"

2. CAPTURE SCROLL (in tabulatorConfig.js)
   └─> scrollPositionRef.current = {
         scrollTop: table internal vertical,
         scrollLeft: table internal horizontal,
         windowScrollY: browser window vertical,
         windowScrollX: browser window horizontal
       }

3. CALL HANDLER (in DsViewPage.jsx)
   └─> handleDeleteRow() or duplicateAndAddRowHandler()
       └─> Calls backend API
           └─> On success: Updates Tabulator directly
               ├─> row.delete() for deletion
               └─> row.update({_id}) for addition

4. TRIGGER CALLBACK
   └─> rowDeleted or rowAdded callback fires
       └─> RESTORE SCROLL (from scrollPositionBeforeLoadRef)
           ├─> window.scrollTo(windowScrollX, windowScrollY)
           └─> rowManager.scrollTop = scrollTop
```

### Data Flow for Row Addition

```
User duplicates row
    ↓
Context menu captures scroll position
    ↓
duplicateAndAddRowHandler() called
    ↓
Backend API: insertRow(rowData)
    ↓
Success: result = {status: 'success', _id: 'abc123'}
    ↓
row.update({...rowData, _id: 'abc123'})
    ↓
Tabulator detects _id is new → triggers rowAdded callback
    ↓
rowAdded callback restores scroll (window + table)
    ↓
Done - row added in place, scroll preserved
```

### Data Flow for Row Deletion

```
User deletes row
    ↓
Context menu captures scroll position
    ↓
handleDeleteRow(row) called
    ↓
Backend API: deleteRow(rowData)
    ↓
Success
    ↓
row.delete() - removes from Tabulator
    ↓
Tabulator triggers rowDeleted callback
    ↓
rowDeleted callback restores scroll (window + table)
    ↓
Done - row removed in place, scroll preserved
```

---

## File Reference

### Primary Files Modified

1. **app/pages/DsView/DsViewPage.jsx** (3329 lines)
   - Core component managing table operations
   - Lines 1116-1180: `deleteAllRowsInQuery` - uses `clearData()`
   - Lines 1182-1250: `deleteAllRowsInView` - uses `clearData()`
   - Lines 2028-2095: `handleDeleteRow` - captures scroll, calls row.delete()
   - Lines 2453-2509: `duplicateAndAddRowHandler` - handles row duplication
   - Lines 3058-3088: `rowAdded` callback - restores scroll after addition
   - Lines 3089-3111: `rowDeleted` callback - restores scroll after deletion

2. **app/pages/DsView/helpers/tabulatorConfig.js** (468 lines)
   - Generates Tabulator configuration including context menus
   - Lines 196-227: "Add row above/below" menu items - capture scroll
   - Lines 228-247: "Delete row" menu item - captures scroll
   - Lines 229-231: "Delete all rows" menu items - no scroll capture needed

3. **app/hooks/useDsOperations.js** (79 lines)
   - Custom React Query mutation hooks
   - Lines 7-15: `useInsertRow` - no query invalidation
   - Lines 22-30: `useDeleteRow` - no query invalidation
   - Lines 32-41: `useDeleteManyRows` - no query invalidation

### Backend Reference (No Changes Made)

- **datagroom-gateway/routes/dsReadApi.js**
  - Line 500: Handles `dbResponse.upsertedId` (MongoDB 4.x format)
  - Returns `{status: 'success', _id: upsertedId}`

---

## Testing Checklist

When making future changes to row operations, verify these scenarios:

- [ ] **Single row deletion**
  - Row disappears immediately without table reload
  - Browser window scroll position preserved
  - Table internal scroll position preserved
  - No network request to reload table data

- [ ] **Row duplication (add above/below)**
  - Row appears immediately without table reload
  - Background color applied to new row
  - After successful save, background color removed
  - Browser window scroll position preserved
  - Table internal scroll position preserved

- [ ] **Delete all rows in view**
  - All visible rows deleted
  - Table shows empty state
  - Filter configuration still active
  - No automatic reload from server
  - Can still add new rows with filter active

- [ ] **Delete all rows in query**
  - All matching rows deleted (even outside current scroll view)
  - Table shows empty state
  - Filter configuration still active
  - No automatic reload from server

- [ ] **Filter save with column width changes**
  - Adjust column widths
  - Save filter immediately
  - Column widths are preserved in saved filter

---

## Common Pitfalls & Solutions

### Pitfall 1: Adding Query Invalidation
**Symptom**: Table reloads, scroll position lost.  
**Solution**: Never add `queryClient.invalidateQueries()` to row operation hooks. Handle UI updates directly with Tabulator API.

### Pitfall 2: Only Preserving Table Scroll
**Symptom**: Browser window jumps to top even though table scroll seems right.  
**Solution**: Must capture and restore BOTH `window.scrollY` AND `rowManager.scrollTop`.

### Pitfall 3: Restoring Scroll Too Early
**Symptom**: Scroll restoration doesn't work reliably.  
**Solution**: Use `requestAnimationFrame()` to ensure scroll restoration happens after DOM updates complete.

### Pitfall 4: Checking Wrong Response Field
**Symptom**: Success handlers don't execute, background colors stick.  
**Solution**: Always check `result.status === 'success'` BEFORE accessing `result._id`.

### Pitfall 5: Using setData() After Mass Delete
**Symptom**: Table reloads from server after deletion, filters might reset.  
**Solution**: Use `table.clearData()` to clear local data without triggering server request.

---

## Future Enhancements

If row operations need additional features, preserve these principles:

1. **Never invalidate queries** for row operations (add, delete, update)
2. **Always capture both scroll positions** (window + table) before operations
3. **Use requestAnimationFrame** for reliable scroll restoration
4. **Update Tabulator directly** using its API methods
5. **Let callbacks handle scroll restoration** (rowAdded, rowDeleted)
6. **Check result.status first** before accessing _id or other fields

---

## Related Documentation

- `SCROLL_PRESERVATION_FIX.md` - Original scroll preservation implementation
- `PROJECT_SUMMARY.md` - Overall project architecture
- Tabulator v5.x documentation: https://tabulator.info/docs/5.5

---

**Document Version**: 1.0  
**Last Updated**: March 5, 2026  
**Author**: Migration from Redux to React Query optimization
