# Filter System Documentation

## Overview
The DsView page implements a comprehensive filtering system that allows users to save, apply, and manage complex filter configurations including header filters, column visibility, column widths, and sort orders.

## Filter Components

### 1. Filter State Management
The filter system maintains several pieces of state:
- `filter` - The name of the currently active filter
- `initialHeaderFilter` - Array of header filter values to apply on table load
- `initialSort` - Array of sort configurations to apply on table load  
- `filterColumnAttrs` - Object containing column visibility and width configurations
- `showAllFilters` - Boolean controlling whether filter UI (header inputs) is visible

### 2. URL-based Filter Persistence
Filters are persisted in two ways:
- **Pathname-based**: Saved filters accessible via `/ds/{dsName}/{dsView}/{filterName}`
- **Query string-based**: Ad-hoc filters via URL search parameters like `?field1=value1&field2=value2`

### 3. Filter Priority
Filter sources are applied with the following priority (highest to lowest):
1. Single record view (`_id` parameter) - bypasses all filtering
2. Query string parameters - ad-hoc filters
3. Pathname-based saved filters - named filter configurations
4. Default view - no filters applied

## How Filters Work

### Loading a Saved Filter
When navigating to `/ds/{dsName}/{dsView}/{filterName}`:

1. **URL Processing Effect** (line ~773)
   - Detects `filterParam` in URL path
   - Loads filter configuration from `viewConfig.filters[filterName]`
   - Extracts `hdrFilters`, `hdrSorters`, and `filterColumnAttrs`
   - Updates state: `setFilter()`, `setInitialHeaderFilter()`, `setInitialSort()`, `setFilterColumnAttrs()`
   - Automatically enables filter UI: `setShowAllFilters(true)`

2. **Column Generation Effect** (line ~2730)
   - Detects changes to `filterColumnAttrs` or `showAllFilters`
   - Regenerates column definitions with/without header filter inputs
   - Sets column visibility and widths based on `filterColumnAttrs`

3. **Filter Application** (line ~853)
   - After state updates, applies filters to Tabulator table
   - Clears existing header filters first
   - Applies saved `hdrFilters` using `table.setHeaderFilterValue()`
   - Applies `filterColumnAttrs` to hide/show columns and set widths
   - Applies `hdrSorters` using `table.setSort()`

### Applying Ad-hoc Filters via Query String
When navigating with query parameters like `?status=Active&priority=High`:

1. **Query String Processing Effect** (line ~600)
   - Parses URL search parameters
   - Converts parameters to Tabulator header filters
   - Updates `initialHeaderFilter` state
   - Automatically enables filter UI: `setShowAllFilters(true)`

2. **Column and Filter Application**
   - Same flow as saved filters (steps 2-3 above)

### Clearing Filters

#### Method 1: Title Click
Clicking the page title triggers `handleTitleClick()` (line ~506):
- Navigates to base view `/ds/{dsName}/{dsView}`
- Clears all search parameters
- Resets filter state to empty
- Clears header filters from table
- Restores all column visibility/widths
- Clears sort orders

#### Method 2: Toggle "Show Filters" Off
When unchecking the "Show filters" checkbox:

1. **Toggle Handler** (line ~548)
   - Updates `showAllFilters` to `false`
   - Saves preference to localStorage
   - Navigates to default view: `navigate(\`/ds/${dsName}/${dsView}\`)`

2. **URL Change Triggers Filter Clearing Effect** (line ~906)
   - Detects no `filterParam` in URL
   - Clears all filter state
   - Applies empty `filterColumnAttrs` to restore all columns
   - Clears header filters and sort orders from table

3. **Column Rebuild Effect** (line ~2785)
   - Detects `showAllFilters` changed to `false`
   - Regenerates columns WITHOUT header filter inputs
   - Calls `table.setColumns()` to update UI

**Note**: This causes two table reloads (one from column rebuild, one from filter clearing), but ensures proper cleanup of filter UI and state.

## Filter Effects and Dependencies

### Main Column Generation Effect
**Dependencies**: `[viewConfig, dsName, dsView, userId, showAllFilters, filterColumnAttrs, filterParam, searchParams]`

This is the primary effect that generates Tabulator column definitions. It:
- Monitors changes to view config and filter state
- Uses hash comparison to avoid unnecessary regeneration
- Generates columns with or without header filter inputs based on `showAllFilters`
- Applies column visibility/width from `filterColumnAttrs`

### Filter Parameter Processing Effect  
**Dependencies**: `[filterParam, viewConfig, searchParams, _id]`

Handles pathname-based filter loading. It:
- Loads filter data from `viewConfig.filters[filterParam]`
- Updates all filter-related state
- Applies filters to the table with scroll preservation
- Skips if `_id` or query string params are present (higher priority)

### Query String Processing Effect
**Dependencies**: `[searchParams, viewConfig]`

Handles query string parameter filters. It:
- Converts URL params to header filters
- Updates `initialHeaderFilter` and `filterColumnAttrs`
- Applies filters with scroll preservation
- Runs once per page load (`lastProcessedSearchRef` prevents re-runs)

### ShowAllFilters Column Rebuild Effect
**Dependencies**: `[showAllFilters, viewConfig]`

Dedicated effect for toggling filter UI visibility. It:
- Regenerates columns when `showAllFilters` changes
- Adds/removes header filter input fields
- Updates table immediately with `table.setColumns()`

## Key Implementation Details

### Scroll Position Preservation
All filter operations use `executeWithScrollPreservation()` to maintain user's scroll position during table updates.

### Double Reload on Filter Toggle Off
When unchecking "Show filters", two reloads occur:
1. Column rebuild effect removes header filter inputs
2. Filter clearing effect resets table data to unfiltered state

This is intentional - both operations are necessary for proper cleanup.

### Filter Saving
Filters are saved via the FilterControls component, which:
- Captures current header filters using `table.getHeaderFilters()`
- Captures current sort orders using `table.getSorters()`
- Captures column visibility/widths from table column definitions
- Sends to backend for storage in view configuration
- Updates viewConfig which triggers filter reload

### Column Attributes Structure
`filterColumnAttrs` is an object mapping column fields to their configuration:
```javascript
{
  "columnField": {
    "visible": true/false,
    "width": 150  // pixels
  }
}
```

### Initial URL Processing
The system delays table mounting until URL-based filters are fully processed:
- `initialUrlProcessed` flag prevents premature table render
- Set to `true` only after columns are generated with correct filter state
- Ensures filters are applied before first data load

## Common Scenarios

### Scenario 1: User applies ad-hoc filters then navigates away
- Filters are not saved
- URL query string is lost on navigation
- Next visit to view shows default (no filters)

### Scenario 2: User saves a filter
- Current filter state is persisted to backend
- Filter becomes accessible via `/ds/{dsName}/{dsView}/{filterName}`
- Other users can access the same saved filter

### Scenario 3: User turns off filters while viewing filtered data
- Column headers update to remove filter inputs
- Navigation triggers automatic filter clearing
- Table reloads with all records visible
- URL updates to default view path

### Scenario 4: User clicks title while filters are active
- All filter state is cleared immediately
- Table updates to show all records
- URL resets to base view path
- Filter UI remains visible (if `showAllFilters` was true)

## Future Considerations

### Potential Optimizations
1. Combine column rebuild and filter clearing into single operation
2. Add debouncing to prevent multiple rapid reloads
3. Cache column definitions to avoid regeneration

### Known Limitations
1. Double reload when toggling filters off (acceptable tradeoff for clean state)
2. No confirmation when clearing filters that took time to configure
3. Filter state not preserved in browser back/forward navigation (by design - URL is source of truth)
