# DS Description Inline Editor

**Date:** March 8, 2026  
**Feature:** Inline editing of dataset descriptions directly from the DS View page

## Overview

This feature allows users to edit dataset descriptions without navigating to the DsViewEdit page. An "Edit" button is displayed alongside the description, which opens a full-screen CodeMirror modal editor for markdown editing. The implementation ensures data integrity by fetching fresh configuration before editing and only modifying the description field when saving.

## User Experience

### Key Features
- **Edit button placement**: Below the rendered description (or "Add Description" when empty)
- **Modal editor**: Full-screen CodeMirror editor with markdown highlighting and spell-checking
- **Fresh data fetch**: Latest backend configuration is fetched when edit button is clicked
- **Atomic updates**: Only the description field is modified; all other settings remain unchanged
- **Loading states**: Visual feedback during config fetch and save operations
- **Keyboard shortcuts**: Ctrl+Enter to save, ESC to cancel
- **Image upload**: Inline attachment support for images
- **Theme support**: Respects light/dark theme preference

### UI Layout (March 8, 2026 Update)
1. **Description Box** (59% width, bordered, shadowed)
   - Rendered markdown content
   - Edit button below content
2. **Control Panel** (59% width, bordered, shadowed)
   - Hover-to-expand behavior
   - Shows headers only when collapsed
3. **Filter Controls** (59% width, bordered, shadowed when visible)
   - Appears when "Show filters" is toggled
4. **Data Bar** (full width)
   - Total records, connection status, refresh button

## Technical Implementation

### Components Created

#### 1. DescriptionEditorModal.jsx
**Location:** `app/pages/DsView/components/DescriptionEditorModal.jsx`

**Purpose:** Full-screen modal with CodeMirror editor for markdown editing

**Key Features:**
```javascript
// Spell-checker initialization (critical!)
window.CodeMirrorSpellChecker({
  codeMirrorInstance: window.CodeMirror,
});

// CodeMirror configuration
{
  lineNumbers: true,
  lineWrapping: true,
  mode: 'spell-checker',
  backdrop: 'markdown',
  highlightFormatting: true,
  theme: cmTheme,  // light: 'eclipse', dark: 'monokai'
  scrollbarStyle: 'null',
}
```

**Props:**
- `show` - Modal visibility
- `initialValue` - Description text to edit
- `onSave(editedText)` - Save callback
- `onCancel()` - Cancel callback
- `isLoading` - Shows spinner while fetching config
- `isSaving` - Shows saving state on button

**Critical Bug Fix:** The spell-checker mode must be initialized before creating the CodeMirror instance. Without this, markdown highlighting doesn't work until a cell editor is opened first.

### Changes to DsViewPage.jsx

#### 1. Imports Added
```javascript
import { useQueryClient } from '@tanstack/react-query';
import { fetchViewColumns, setViewDefinitions } from '../../api/ds';
import DescriptionEditorModal from './components/DescriptionEditorModal.jsx';
```

#### 2. State Variables
```javascript
const queryClient = useQueryClient();
const [isEditingDescription, setIsEditingDescription] = useState(false);
const [freshViewConfig, setFreshViewConfig] = useState(null);
const [isLoadingFreshConfig, setIsLoadingFreshConfig] = useState(false);
const [isSavingDescription, setIsSavingDescription] = useState(false);
```

#### 3. Handler Functions

**handleOpenDescriptionEditor()** (Lines ~1327-1346)
```javascript
const handleOpenDescriptionEditor = useCallback(async () => {
  setIsEditingDescription(true);
  setIsLoadingFreshConfig(true);
  
  try {
    // Fetch fresh view config to ensure we have latest backend state
    const freshConfig = await fetchViewColumns(dsName, dsView, userId);
    setFreshViewConfig(freshConfig);
    setIsLoadingFreshConfig(false);
  } catch (error) {
    console.error('Error fetching fresh config:', error);
    setNotificationType('error');
    setNotificationMessage('Failed to load latest configuration');
    setShowNotification(true);
    setIsEditingDescription(false);
    setIsLoadingFreshConfig(false);
  }
}, [dsName, dsView, userId]);
```

**handleSaveDescription(editedDescription)** (Lines ~1348-1399)
```javascript
const handleSaveDescription = useCallback(async (editedDescription) => {
  setIsSavingDescription(true);
  
  try {
    // CRITICAL: Validate column data exists
    if (!freshViewConfig || !freshViewConfig.columnAttrs || 
        freshViewConfig.columnAttrs.length === 0) {
      console.error('Critical: Cannot save - column attributes missing or empty!');
      // Show error and abort
      return;
    }

    // Construct payload with all settings, only description changed
    // CRITICAL: API returns 'columnAttrs' but expects 'viewDefs' in request
    const payload = {
      dsName,
      dsView,
      dsUser: userId,
      viewDefs: freshViewConfig.columnAttrs,  // NOT viewDefs!
      jiraConfig: freshViewConfig.jiraConfig || null,
      jiraAgileConfig: freshViewConfig.jiraAgileConfig || null,
      dsDescription: { dsDescription: editedDescription },  // Only this changes
      otherTableAttrs: freshViewConfig.otherTableAttrs || {},
      aclConfig: freshViewConfig.aclConfig || null,
      jiraProjectName: freshViewConfig.jiraProjectName || '',
      perRowAccessConfig: freshViewConfig.perRowAccessConfig || {},
    };

    const [success, result] = await setViewDefinitions(payload);
    
    if (success) {
      setIsEditingDescription(false);
      setFreshViewConfig(null);
      setIsSavingDescription(false);
      
      // Invalidate React Query cache to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['dsView', dsName, dsView, userId] });
      
      // Show success notification
      setNotificationType('success');
      setNotificationMessage('Description updated successfully');
      setShowNotification(true);
    }
  } catch (error) {
    // Error handling...
  }
}, [dsName, dsView, userId, freshViewConfig, queryClient]);
```

**handleCancelDescriptionEditor()** (Lines ~1401-1405)
```javascript
const handleCancelDescriptionEditor = useCallback(() => {
  setIsEditingDescription(false);
  setFreshViewConfig(null);
  setIsLoadingFreshConfig(false);
}, []);
```

#### 4. UI Integration

**Description Box with Edit Button** (Lines ~2975-3018)
```jsx
<div
  style={{
    border: '1px solid var(--color-border, #ddd)',
    borderRadius: '8px',
    padding: '1rem 1.5rem',
    marginBottom: '1rem',
    width: '59%',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
  }}
>
  <div className={styles.dsDescription} 
       dangerouslySetInnerHTML={{ __html: renderedHtml }} />
  <button
    className="btn btn-link"
    onClick={handleOpenDescriptionEditor}
    style={{
      padding: '0 6px',
      fontSize: '1.45rem',  // Matches --info-main-size
      lineHeight: '1',
      display: 'inline-flex',
      alignItems: 'center',
      marginTop: '0.5rem',
    }}
  >
    <i className="fas fa-edit" 
       style={{ fontSize: '1.45rem', marginRight: '6px' }}></i>
    Edit
  </button>
</div>
```

**Modal Integration** (Lines ~3374-3381)
```jsx
<DescriptionEditorModal
  show={isEditingDescription}
  initialValue={freshViewConfig?.dsDescription?.dsDescription || ''}
  onSave={handleSaveDescription}
  onCancel={handleCancelDescriptionEditor}
  isLoading={isLoadingFreshConfig}
  isSaving={isSavingDescription}
/>
```

## API Details

### Endpoint Used
**POST** `/ds/view/setViewDefinitions`

**Implementation:** `datagroom-gateway/routes/dsReadApi.js` (Line 1069)

### Data Flow

1. **Read Configuration**
   - Endpoint: `GET /ds/view/columns/${dsName}/${dsView}/${userId}`
   - Response includes: `columnAttrs`, `jiraConfig`, `dsDescription`, etc.

2. **Write Configuration**
   - Endpoint: `POST /ds/view/setViewDefinitions`
   - Body structure:
     ```javascript
     {
       dsName: string,
       dsView: string,
       dsUser: string,
       viewDefs: columnAttrs[],  // Array of column definitions
       jiraConfig: object | null,
       jiraAgileConfig: object | null,
       dsDescription: { dsDescription: string },
       otherTableAttrs: object,
       aclConfig: object | null,
       jiraProjectName: string,
       perRowAccessConfig: object
     }
     ```

### Critical Warning: Field Name Mismatch

⚠️ **IMPORTANT:** The API has a naming inconsistency:
- **Response field:** `columnAttrs` (array of column definitions)
- **Request field:** `viewDefs` (expects the same array)

**Catastrophic Bug Fixed:** Initial implementation used `freshViewConfig.viewDefs` which doesn't exist, causing an empty array `[]` to be sent, wiping out all column configurations. 

**Correct Implementation:**
```javascript
viewDefs: freshViewConfig.columnAttrs  // Use columnAttrs from response
```

## Styling Details

### Button Styling
Matches data bar buttons (Total records, Refresh):
- Font size: `1.45rem` (CSS variable: `--info-main-size`)
- Padding: `0 6px`
- Line height: `1`
- Display: `inline-flex`
- Icon size: `1.45rem` with `6px` right margin

### Box Styling (59% width containers)
```css
border: 1px solid var(--color-border, #ddd);
border-radius: 8px;
padding: 1rem 1.5rem;
margin-bottom: 1rem;
width: 59%;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
```

Applied to:
- Description box
- Control panel
- Filter controls (when visible)

### Control Panel Hover Animation

**Components Modified:**
- `ControlPanel.jsx` - Added `useState` for `isExpanded`
- `ControlPanel.module.css` - Added collapse/expand transitions

**Collapsed State (Default):**
```css
.sectionContent {
  max-height: 0;
  opacity: 0;
  padding: 0 12px;
  overflow: hidden;
  transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
}
```

**Expanded State (On Hover):**
```css
.controlPanel.expanded .sectionContent {
  max-height: 500px;
  opacity: 1;
  padding: 12px;
}
```

**Behavior:**
- Shows only section headers when collapsed
- Smoothly expands on hover to reveal all controls
- 0.3s animation for smooth transition
- Conserves vertical space significantly

## CodeMirror Integration

### Dependencies
All loaded via script tags in `index.html`:
```html
<!-- Lines 13-23 -->
<link rel="stylesheet" href="/assets/vendors/codemirror-5.58.1/lib/codemirror.css">
<link rel="stylesheet" href="/assets/vendors/codemirror-5.58.1/theme/eclipse.css">
<link rel="stylesheet" href="/assets/vendors/codemirror-5.58.1/theme/monokai.css">
<script src="/assets/vendors/codemirror-5.58.1/lib/codemirror.js"></script>
<script src="/assets/vendors/codemirror-5.58.1/mode/markdown/markdown.js"></script>
<script src="/assets/vendors/codemirror-5.58.1/addon/mode/overlay.js"></script>
<link rel="stylesheet" href="/assets/vendors/codemirror.spell-checker/spell-checker.min.css">
<script src="/assets/vendors/codemirror.spell-checker/spell-checker.min.js"></script>
```

### Initialization Sequence (CRITICAL)

1. **Must initialize spell-checker first:**
   ```javascript
   window.CodeMirrorSpellChecker({
     codeMirrorInstance: window.CodeMirror,
   });
   ```

2. **Then create CodeMirror instance:**
   ```javascript
   codeMirrorRef.current = window.CodeMirror.fromTextArea(textareaRef.current, {
     mode: 'spell-checker',
     backdrop: 'markdown',
     // ... other options
   });
   ```

3. **Add 100ms delay** before initialization to ensure DOM is ready:
   ```javascript
   setTimeout(() => {
     // Initialize here
   }, 100);
   ```

**Why This Matters:** The spell-checker mode registration is global and persists. If a cell editor (MyCodeMirror) is opened first, it registers the mode, which is why markdown highlighting "magically" worked after editing a cell. The DescriptionEditorModal now independently initializes the mode.

## Testing Checklist

- [x] Edit button appears below description
- [x] Modal opens with loading spinner
- [x] Fresh config fetched from backend
- [x] CodeMirror initializes with markdown highlighting (without opening cell editor first)
- [x] Description text loads correctly
- [x] Ctrl+Enter saves, ESC cancels
- [x] Save button shows loading state
- [x] Success notification appears
- [x] Description updates without page reload
- [x] Column attributes NOT affected (critical!)
- [x] Error handling for network failures
- [x] "Add Description" button when description is empty
- [x] Theme switching (light/dark) works
- [x] Image upload via drag-drop works
- [x] Button styling matches other UI elements
- [x] Box styling consistent with control panel
- [x] Control panel hover animation works
- [x] Filter controls box appears with border/shadow

## Known Limitations

1. **Description scope**: System-level in the modal (extraParams.dsName set to 'system' for image uploads)
2. **Concurrent edits**: No conflict resolution if multiple users edit simultaneously (last write wins)
3. **Validation**: No client-side validation of description length or content
4. **Undo/Redo**: CodeMirror's built-in undo only works within current session

## Future Enhancements

- [ ] Add description preview toggle (rendered markdown view)
- [ ] Add markdown syntax help/toolbar
- [ ] Add auto-save draft to localStorage
- [ ] Add conflict detection/resolution for concurrent edits
- [ ] Add description version history
- [ ] Add description length counter
- [ ] Support for keyboard shortcut customization
- [ ] Collapsible description box when not needed

## Related Files

### Created
- `app/pages/DsView/components/DescriptionEditorModal.jsx` (195 lines)

### Modified
- `app/pages/DsView/DsViewPage.jsx`
  - Added imports (3 lines)
  - Added state variables (5 lines)
  - Added handler functions (80 lines)
  - Modified render UI (50 lines)
- `app/pages/DsView/components/ControlPanel.jsx`
  - Added hover state (2 lines)
  - Added event handlers (2 lines)
- `app/pages/DsView/components/ControlPanel.module.css`
  - Added collapse/expand animation (20 lines)

### Referenced
- `app/api/ds.js` - `fetchViewColumns`, `setViewDefinitions`
- `app/hooks/useDsView.js` - React Query integration
- `app/pages/DsView/helpers/tabulatorConfig.js` - Markdown renderer (`md`)
- `datagroom-gateway/routes/dsReadApi.js` - Backend API endpoint

## Version History

**March 8, 2026** - Initial implementation
- Inline description editing with CodeMirror
- Fresh config fetch before edit
- Atomic description-only updates
- Hover-to-expand control panel
- Consistent 59% width layout for description, control panel, filters
- Box styling with borders and shadows
- Button styling matching data bar elements
