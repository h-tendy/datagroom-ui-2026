# Vendored Tabulator Libraries

This directory contains vendored copies of `react-tabulator` and `tabulator-tables` for direct control and customization.

## Source Information

### react-tabulator
- **Version**: 0.13.8
- **Source Repository**: https://github.com/h-tendy/react-tabulator (custom fork)
- **Original Repository**: https://github.com/ngduc/react-tabulator
- **Commit Hash**: 757fad5e3e458159816072e679fe3ff7991c5963
- **Vendored Date**: January 26, 2026
- **License**: MIT

### tabulator-tables
- **Version**: 4.8.1
- **Source Repository**: https://github.com/h-tendy/tabulator (custom fork)
- **Original Repository**: https://github.com/olifolkerd/tabulator
- **Vendored Date**: January 26, 2026
- **License**: MIT

## Directory Structure

```
tabulator/
├── react-tabulator/     # React wrapper component for Tabulator
│   ├── lib/            # Compiled JavaScript files
│   │   ├── ReactTabulator.js         # Main React component
│   │   ├── React15Tabulator.js       # React 15 compatibility
│   │   ├── editors/                  # Custom editors (DateEditor, MultiSelectEditor)
│   │   ├── formatters/               # Custom formatters (MultiValueFormatter)
│   │   └── Utils.js                  # Utility functions
│   ├── css/            # Tabulator theme CSS files
│   └── *.d.ts          # TypeScript definitions
├── tabulator-tables/   # Core Tabulator library
│   ├── dist/           # Compiled distribution files
│   │   ├── js/         # JavaScript bundles (tabulator.js)
│   │   └── css/        # CSS themes
│   └── src/            # Source files (for customization)
│       ├── js/         # JavaScript source modules
│       └── scss/       # SASS source files
└── styles/             # Consolidated and custom styles
    ├── tabulator-custom.css        # Merged base + custom styles
    ├── tabulator_*.css             # Theme variants (midnight, modern, simple)
    └── bootstrap/, bulma/, etc.    # Framework-specific themes
```

## Usage

Import using the `@tabulator` alias configured in vite.config.js:

```javascript
// Import React component
import { ReactTabulator } from '@tabulator/react-tabulator/lib/ReactTabulator';

// Import custom editors
import DateEditor from '@tabulator/react-tabulator/lib/editors/DateEditor';

// Import CSS
import '@tabulator/styles/tabulator-custom.css';
// or use specific themes:
import '@tabulator/styles/tabulator_midnight.css';
```

## Dependencies

The following peer dependencies are required and listed in package.json:
- `pick-react-known-prop` (^0.1.5) - Filters React props
- `react-tag-autocomplete` (^5.7.1) - For MultiSelectEditor
- `es6-promise` (^4.2.8) - Browser compatibility

## Modifications

1. **Internal imports updated**: react-tabulator now imports from local `../../tabulator-tables/dist/js/tabulator` instead of npm package
2. **Consolidated CSS**: Created `styles/tabulator-custom.css` merging base tabulator.css with custom simpleStyles.css from reference project
3. **Vite configuration**: Added CommonJS support and path aliases for seamless integration

## Customization

To customize the Tabulator library:
1. Edit source files in `tabulator-tables/src/`
2. Rebuild using the original build process (see tabulator-tables/README.md)
3. Or directly edit the compiled files in `dist/` for quick changes

For styling customizations:
- Edit `styles/tabulator-custom.css` for global changes
- Create new theme files in `styles/` directory
- Modify existing theme CSS files

## Notes

- Both packages are custom forks with specialized editors and formatters
- Unminified sources included for easier debugging and customization
- TypeScript definitions included for future TS migration
- CommonJS modules handled by Vite configuration
