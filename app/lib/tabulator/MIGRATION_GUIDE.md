# Migration Guide: Using Vendored Tabulator Libraries

## Overview
The tabulator libraries have been vendored into `app/lib/tabulator/` for direct control. This guide shows how to update imports when migrating code from the reference project.

## Import Path Changes

### Before (reference project using npm packages):
```javascript
import { ReactTabulator } from 'react-tabulator';
import DateEditor from "react-tabulator/lib/editors/DateEditor";
import 'react-tabulator/lib/styles.css';
import 'react-tabulator/lib/css/tabulator.css';
```

### After (using vendored libraries):
```javascript
import { ReactTabulator } from '@tabulator/react-tabulator/lib';
import DateEditor from '@tabulator/react-tabulator/lib/editors/DateEditor';
import '@tabulator/styles/tabulator-custom.css';
```

## Component Usage Examples

### Basic ReactTabulator Component
```javascript
import React from 'react';
import { ReactTabulator } from '@tabulator/react-tabulator/lib';
import '@tabulator/styles/tabulator-custom.css';

function MyTable() {
  const columns = [
    { title: "Name", field: "name", editor: "input" },
    { title: "Age", field: "age", editor: "number" },
  ];
  
  const data = [
    { name: "John", age: 30 },
    { name: "Jane", age: 25 },
  ];

  return (
    <ReactTabulator
      columns={columns}
      data={data}
      options={{ height: "400px" }}
    />
  );
}
```

### Using Custom Editors
```javascript
import React from 'react';
import { ReactTabulator } from '@tabulator/react-tabulator/lib';
import DateEditor from '@tabulator/react-tabulator/lib/editors/DateEditor';
import '@tabulator/styles/tabulator-custom.css';

function MyTableWithDateEditor() {
  const columns = [
    { title: "Event", field: "event" },
    { 
      title: "Date", 
      field: "date",
      editor: DateEditor,
      editorParams: { format: "YYYY-MM-DD" }
    },
  ];

  return <ReactTabulator columns={columns} data={[]} />;
}
```

### Using Different Themes
```javascript
// Option 1: Use the consolidated custom CSS (includes base + customizations)
import '@tabulator/styles/tabulator-custom.css';

// Option 2: Use a specific theme variant
import '@tabulator/styles/tabulator_midnight.css';

// Option 3: Use framework-specific theme
import '@tabulator/styles/bootstrap/tabulator_bootstrap4.css';

// Option 4: Use original base tabulator CSS
import '@tabulator/styles/tabulator.css';
```

## Migrating MyTabulator Wrapper

If you're migrating the `MyTabulator` wrapper from `reference/common/routes/home/MyTabulator.js`:

```javascript
// app/components/MyTabulator.jsx (new location)
import React, { useRef, useEffect } from 'react';
import { ReactTabulator } from '@tabulator/react-tabulator/lib';
import '@tabulator/styles/tabulator-custom.css';

export default function MyTabulator(props) {
  const tabulatorRef = useRef(null);
  
  // Your custom logic here
  // ... (copy from reference/common/routes/home/MyTabulator.js)
  
  return <ReactTabulator ref={tabulatorRef} {...props} />;
}
```

## Available Custom Components

The vendored react-tabulator includes these custom editors and formatters:

### Editors
- `DateEditor` - Custom date picker editor
  ```javascript
  import DateEditor from '@tabulator/react-tabulator/lib/editors/DateEditor';
  ```
  
- `MultiSelectEditor` - Multi-select dropdown editor
  ```javascript
  import MultiSelectEditor from '@tabulator/react-tabulator/lib/editors/MultiSelectEditor';
  ```

### Formatters
- `MultiValueFormatter` - Format multiple values
  ```javascript
  import MultiValueFormatter from '@tabulator/react-tabulator/lib/formatters/MultiValueFormatter';
  ```

## Accessing Tabulator Instance

```javascript
import React, { useRef } from 'react';
import { ReactTabulator } from '@tabulator/react-tabulator/lib';

function MyComponent() {
  const ref = useRef(null);
  
  const handleButtonClick = () => {
    // Access the underlying Tabulator instance
    const table = ref.current?.table;
    if (table) {
      table.clearFilter();
      table.redraw();
    }
  };
  
  return (
    <>
      <button onClick={handleButtonClick}>Clear Filters</button>
      <ReactTabulator ref={ref} {...props} />
    </>
  );
}
```

## Configuration Options

All standard Tabulator options are available through the `options` prop:

```javascript
<ReactTabulator
  columns={columns}
  data={data}
  options={{
    height: "500px",
    layout: "fitColumns",
    pagination: "local",
    paginationSize: 10,
    movableColumns: true,
    resizableColumns: true,
  }}
/>
```

## Installing Dependencies

Make sure you run `npm install` to install the required peer dependencies:
```bash
npm install
```

This will install:
- `pick-react-known-prop` (^0.1.5)
- `react-tag-autocomplete` (^5.7.1)
- `es6-promise` (^4.2.8)

## Troubleshooting

### Module not found errors
- Verify the `@tabulator` alias is configured in `vite.config.js`
- Check that files exist in `app/lib/tabulator/`

### CommonJS require errors
- Vite config includes `commonjsOptions` to handle require/module.exports
- Should work out of the box with current configuration

### Styling issues
- Make sure you're importing one of the CSS files
- Check CSS import order (custom CSS should come after base CSS)
- Clear browser cache if styles don't update

## Next Steps

When migrating files from `reference/common/routes/home/`:
1. Update import statements as shown above
2. Test that the component renders correctly
3. Verify all custom editors and formatters work
4. Check that CSS styles are applied properly
