import React, { useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Row, Col, Form } from 'react-bootstrap';
import { useAuth } from '../../auth/AuthProvider';
import MyTabulator from '../../components/MyTabulator';
import styles from '../DsView/DsViewPage.module.css';
import MyTextArea from '../../components/editors/MyTextArea';
import MarkdownIt from 'markdown-it';
import markdownItBracketedSpans from 'markdown-it-bracketed-spans';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItContainer from 'markdown-it-container';
import markdownItSub from 'markdown-it-sub';
import markdownItSup from 'markdown-it-sup';
import markdownItHighlightjs from 'markdown-it-highlightjs';

import '../DsView/DsViewSimple.css';
import '../DsView/solarized-light.css';
import '../DsView/simpleStyles.css';

// Configure MarkdownIt with plugins for rendering selector and doc columns
const md = new MarkdownIt({
  linkify: true,
  html: true
})
  .use(markdownItBracketedSpans)
  .use(markdownItAttrs)
  .use(markdownItContainer, 'code')
  .use(markdownItSub)
  .use(markdownItSup)
  .use(markdownItHighlightjs);

// API base URL configuration
// In production, use same origin; in development, could be localhost
const BASE = import.meta.env.VITE_API_BASE || '';
const API_URL = BASE;

/**
 * DsEditLogPage - Displays a paginated, filterable history of all edits made to a dataset
 * Reference: reference/common/routes/home/DsEditLog.js
 * 
 * Features:
 * - Remote pagination, sorting, and filtering via Tabulator
 * - Read-only view of edit log entries
 * - Markdown rendering for selector and doc columns
 * - Filter toggle to show/hide all column filters at once
 * - Displays total record count
 */
function DsEditLogPage() {
  const { dsName } = useParams();
  const auth = useAuth();
  const userId = auth.userId;

  // State management
  const [pageSize, setPageSize] = useState(30);
  const [totalRecs, setTotalRecs] = useState(0);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [columns, setColumns] = useState([]);

  // Ref to Tabulator instance
  const tabulatorRef = useRef(null);

  // Set document title
  React.useEffect(() => {
    document.title = `Edit-log: ${dsName}`;
  }, [dsName]);

  /**
   * ajaxResponse callback - captures total record count from server response
   * Reference: DsEditLog.js lines 218-222
   */
  const ajaxResponse = useCallback((url, params, response) => {
    console.log('ajaxResponse:', response);
    if (response && response.total !== undefined) {
      setTotalRecs(response.total);
    }
    return response;
  }, []);

  /**
   * toggleFilters - Toggles all column header filters on/off simultaneously
   * Reference: DsEditLog.js lines 72-99
   */
  const toggleFilters = useCallback(() => {
    if (!tabulatorRef.current?.table) {
      console.log('toggleFilters: no table ref');
      return;
    }

    try {
      const currentDefs = tabulatorRef.current.table.getColumnDefinitions();
      console.log('toggleFilters: currentDefs', currentDefs);
      let newVal;

      const updatedColumns = [];
      for (let j = 0; j < currentDefs.length; j++) {
        // Toggle between false and 'input'
        newVal = currentDefs[j].headerFilter ? false : 'input';
        const updatedCol = { ...currentDefs[j], headerFilter: newVal };
        updatedColumns.push(updatedCol);
        console.log(`toggleFilters: column ${currentDefs[j].field} headerFilter set to`, newVal);
      }

      // Update both the table and the state
      setColumns(updatedColumns);
      tabulatorRef.current.table.setColumns(updatedColumns);
      console.log('toggleFilters: columns updated');
    } catch (e) {
      console.error('toggleFilters error:', e);
    }
  }, []);

  /**
   * recordRef - Callback to capture Tabulator ref
   * Reference: DsEditLog.js lines 105-109
   */
  const recordRef = useCallback((ref) => {
    tabulatorRef.current = ref;
    return true;
  }, []);

  /**
   * cellEditCheck - Always returns false since edit log is read-only
   * Reference: DsEditLog.js lines 66-68
   */
  const cellEditCheck = useCallback(() => {
    return false;
  }, []);

  /**
   * toggleSingleFilter - Toggles filter for a single column via header menu
   * Reference: DsEditLog.js lines 125-152
   */
  const toggleSingleFilter = useCallback((e, column) => {
    if (!tabulatorRef.current?.table) return;

    try {
      const currentDefs = tabulatorRef.current.table.getColumnDefinitions();
      let newVal;

      for (let j = 0; j < currentDefs.length; j++) {
        if (currentDefs[j].field === column.getField()) {
          newVal = currentDefs[j].headerFilter ? false : 'input';
          tabulatorRef.current.table.updateColumnDefinition(currentDefs[j].field, {
            headerFilter: newVal
          });
        }
      }
    } catch (e) {
      console.error('toggleSingleFilter error:', e);
    }
  }, []);

  /**
   * setColumnDefinitions - Defines the 9 columns for the edit log table
   * Reference: DsEditLog.js lines 154-216
   */
  const setColumnDefinitions = useCallback(() => {
    const headerMenu = [
      {
        label: 'Toggle Filters',
        action: toggleSingleFilter
      }
    ];

    const columnAttrs = [
      { field: 'opr', title: 'opr', width: 100, formatter: 'textarea', headerTooltip: true, hozAlign: 'center', vertAlign: 'middle', headerFilter: false },
      { field: 'status', title: 'status', width: 100, formatter: 'textarea', headerTooltip: true, hozAlign: 'center', vertAlign: 'middle', headerFilter: false },
      { field: 'user', title: 'user', width: 150, formatter: 'textarea', headerTooltip: true, hozAlign: 'center', vertAlign: 'middle', headerFilter: false },
      { field: 'date', title: 'date', width: 150, formatter: 'textarea', headerTooltip: true, hozAlign: 'center', vertAlign: 'middle', headerFilter: false },
      { field: 'column', title: 'column', width: 150, formatter: 'textarea', headerTooltip: true, hozAlign: 'center', vertAlign: 'middle', headerFilter: false },
      { field: 'selector', title: 'selector', width: 200, formatter: 'textarea', headerTooltip: true, headerFilter: false },
      { field: 'oldVal', title: 'oldVal', width: 200, formatter: 'textarea', headerTooltip: true, headerFilter: false },
      { field: 'newVal', title: 'newVal', width: 200, formatter: 'textarea', headerTooltip: true, headerFilter: false },
      { field: 'doc', title: 'doc', width: 300, formatter: 'textarea', headerTooltip: true, headerFilter: false },
    ];

    const columns = [];

    for (let i = 0; i < columnAttrs.length; i++) {
      const col = JSON.parse(JSON.stringify(columnAttrs[i]));
      col.headerMenu = headerMenu;
      col.editable = cellEditCheck;

      // Special handling for selector and doc columns - newline conversion
      if (col.field === 'selector' || col.field === 'doc') {
        col.formatter = (cell) => {
          let value = cell.getValue();
          const newLine = String.fromCharCode(13, 10);

          if (value) {
            value = value.replace(/\\\\n/g, '__dg__newline');
            value = value.replace(/\\n/g, newLine);
            value = value.replace(/__dg__newline/g, '\\n');
            return `<div style="white-space:pre-wrap;word-wrap:break-word;">${value}</div>`;
          }
          return '';
        };
      }

      // Markdown rendering for textarea columns
      if (col.editor === 'textarea' || (col.editor === false && col.formatter === 'textarea')) {
        col.formatter = (cell) => {
          let value = cell.getValue();
          if (typeof value !== 'string') return value;
          value = md.render(value);
          return `<div style="white-space:normal;word-wrap:break-word;margin-bottom:-12px">${value}</div>`;
        };
        col.variableHeight = true;

        if (col.editor === 'textarea') {
          col.editor = MyTextArea;
          col.cellEditCancelled = (cell) => {
            cell.getRow().normalizeHeight();
          };
        }
      }

      columns.push(col);
    }

    return columns;
  }, [cellEditCheck, toggleSingleFilter]);

  // Initialize columns on mount
  React.useEffect(() => {
    setColumns(setColumnDefinitions());
  }, [setColumnDefinitions]);

  // Hardcode dsView to "default" to match reference implementation
  // Reference: DsEditLog.js has a bug where dsView is undefined from route params
  // The pattern suggests using "default" as the view name
  const dsView = 'default';

  return (
    <div className={styles.container}>
      {/* Page Title */}
      <Row>
        <Col md={12} sm={12} xs={12}>
          <h3 style={{ float: 'center' }}>
            <label className="underline">Editlog view: {dsName}</label>
          </h3>
        </Col>
      </Row>
      <br />

      {/* Filter Toggle Checkbox */}
      <Row>
        <Col md={12} sm={12} xs={12}>
          <Form inline>
            <Form.Check
              inline
              type="checkbox"
              label="&nbsp;Show all filters"
              checked={showAllFilters}
              onChange={(event) => {
                const checked = event.target.checked;
                setShowAllFilters(checked);
                localStorage.setItem('showAllFilters', JSON.stringify(checked));
                toggleFilters();
              }}
            />
          </Form>
        </Col>
      </Row>

      {/* Total Records Display */}
      <Row>
        <Col md={4} sm={4} xs={4}>
          <b>Total records: {totalRecs}</b>
        </Col>
      </Row>

      {/* Tabulator Table */}
      <Row>
        <div>
          <MyTabulator
            columns={columns}
            data={[]}
            options={{
              ajaxURL: `${API_URL}/ds/view/editLog/${dsName}/${dsView}/${userId}`,
              ajaxConfig: {
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include'
              },
              pagination: 'remote',
              paginationDataSent: {
                page: 'page',
                size: 'per_page'
              },
              paginationDataReceived: {
                last_page: 'total_pages'
              },
              current_page: 1,
              paginationSize: pageSize,
              paginationSizeSelector: [10, 25, 50, 100, 500, true],
              ajaxResponse: ajaxResponse,
              ajaxError: function (error) {
                console.error('ajaxError', error);
              },
              index: '_id',
              ajaxSorting: true,
              ajaxFiltering: true,
              clipboard: true,
              // Row formatter: non-saved rows (no _id) shown with theme-aware colors
              rowFormatter: (row) => {
                const rootStyles = getComputedStyle(document.documentElement);
                const rowElement = row.getElement();
                
                if (!row.getData()._id) {
                  // New unsaved row - use text-muted color with transparency
                  const mutedColor = rootStyles.getPropertyValue('--color-text-muted').trim();
                  rowElement.style.backgroundColor = `${mutedColor}33`; // 33 = ~20% opacity in hex
                } else {
                  // Saved row - use normal background color from theme
                  rowElement.style.backgroundColor = rootStyles.getPropertyValue('--color-bg').trim();
                }
              },
              // Cell hover effects - use theme-aware colors
              cellMouseEnter: (e, cell) => {
                const rootStyles = getComputedStyle(document.documentElement);
                const hoverColor = rootStyles.getPropertyValue('--color-primary').trim();
                if (cell.getElement().style.backgroundColor !== `${hoverColor}33`) {
                  cell.__dg__prevBgColor = cell.getElement().style.backgroundColor;
                }
                cell.getElement().style.backgroundColor = `${hoverColor}33`; // 33 = ~20% opacity
              },
              cellMouseLeave: (e, cell) => {
                cell.getElement().style.backgroundColor = cell.__dg__prevBgColor;
                delete cell.__dg__prevBgColor;
              },
            }}
            innerref={recordRef}
          />
        </div>
      </Row>
    </div>
  );
}

export default DsEditLogPage;
