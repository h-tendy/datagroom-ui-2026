/**
 * DsView Page - Dataset Viewer and Editor
 * 
 * Main component for viewing and editing dataset records with:
 * - Interactive Tabulator table
 * - Real-time collaborative editing via Socket.io
 * - Cell-level locking
 * - Advanced filtering and sorting
 * - JIRA integration
 * - Excel export
 * - Presentation mode
 * 
 * Migration Note: This is a partial implementation framework.
 * The full 2,360-line reference implementation needs to be incrementally
 * migrated with all methods, handlers, and features.
 */

import React, { useState, useEffect, useRef, useReducer, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Row, Col } from 'react-bootstrap';
import styles from './DsViewPage.module.css';
import { useAuth } from '../../auth/AuthProvider';

// Hooks
import useDsView from '../../hooks/useDsView';
import useEditCell from '../../hooks/useEditCell';
import { useInsertRow, useDeleteRow, useDeleteManyRows, useAddColumn, useDeleteColumn } from '../../hooks/useDsOperations';
import useDatasetSocket from '../../hooks/useDatasetSocket';

// Components
import MyTabulator from '../../components/MyTabulator';
import Notification from '../../components/Notification';
import FilterControls from './components/FilterControls.jsx';
import Modal from './components/Modal.jsx';
import ModalEditor from './components/ModalEditor.jsx';
import JiraForm from './components/jiraForm.jsx';

// Editors
import * as DateEditorModule from '@tabulator/react-tabulator/lib/editors/DateEditor';
const DateEditor = DateEditorModule.default;
import MyTextArea from '../../components/editors/MyTextArea.jsx';
import MyCodeMirror from '../../components/editors/MyCodeMirror.jsx';
import MyAutoCompleter from '../../components/editors/MyAutoCompleter.jsx';
import MySingleAutoCompleter from '../../components/editors/MySingleAutoCompleter.jsx';
import ColorPicker from '../../components/editors/ColorPicker.jsx';

// Helpers
import createClipboardHelpers from './helpers/clipboardHelpers';
import createDomHelpers from './helpers/domHelpers';
import createTabulatorConfig from './helpers/tabulatorConfig';
import createJiraHelpers from './helpers/jiraHelpers.jsx';
import { applyFilterColumnAttrs } from './helpers/filterHelpers';

// Reducer
import { editReducer, initialEditState, EDIT_ACTION_TYPES } from './reducers/editReducer';

// Styles
import './DsView.css';
import './DsViewSimple.css';
import '@tabulator/styles/tabulator-custom.css';
import 'highlight.js/styles/default.css';

// API
const API_URL = import.meta.env.VITE_API_BASE || '';

function DsViewPage() {
  const { dsName, dsView, filter: filterParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const userId = auth.userId;

  // Refs
  const tabulatorRef = useRef(null);
  const timersRef = useRef({});
  const cellImEditingRef = useRef(null);
  const reqCount = useRef(0);
  const fetchAllMatchingRecordsRef = useRef(false);
  
  // Store edit-related state in refs so cellEditCheck can access current values
  const singleClickEditRef = useRef(false);
  const disableEditingRef = useRef(false);
  const originalColumnAttrsRef = useRef(null);

  // Fetch view configuration
  const { data: viewConfig, isLoading, isError, error } = useDsView(dsName, dsView, userId);

  // Mutations
  const editCellMutation = useEditCell(dsName, dsView, userId);
  const insertRowMutation = useInsertRow(dsName, dsView, userId);
  const deleteRowMutation = useDeleteRow(dsName, dsView, userId);
  const deleteManyRowsMutation = useDeleteManyRows(dsName, dsView, userId);
  const addColumnMutation = useAddColumn(dsName, dsView, userId);
  const deleteColumnMutation = useDeleteColumn(dsName, dsView, userId);

  // Edit state
  const [editState, dispatchEdit] = useReducer(editReducer, initialEditState);

  // UI State
  const [pageSize, setPageSize] = useState(30);
  const [filter, setFilter] = useState('');
  const [initialHeaderFilter, setInitialHeaderFilter] = useState([]);
  const [initialSort, setInitialSort] = useState([]);
  const [filterColumnAttrs, setFilterColumnAttrs] = useState({});
  const [showAllFilters, setShowAllFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('showAllFilters');
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });
  const [frozenCol, setFrozenCol] = useState(null);
  const [chronologyDescending, setChronologyDescending] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0); // Counter to force table refresh
  const [fetchAllMatchingRecords, setFetchAllMatchingRecords] = useState(false);
  const [totalRecs, setTotalRecs] = useState(0);
  const [moreMatchingDocs, setMoreMatchingDocs] = useState(false);
  
  // Column resize tracking ref
  const columnResizedRecentlyRef = useRef(false);
  // Track last-processed search string so we don't re-apply same URL twice
  const lastProcessedSearchRef = useRef('');
  
  // Initialize singleClickEdit from localStorage
  const [singleClickEdit, setSingleClickEdit] = useState(() => {
    try {
      const saved = localStorage.getItem('singleClickEdit');
      const value = saved ? JSON.parse(saved) : false;
      singleClickEditRef.current = value; // Sync ref
      return value;
    } catch {
      return false;
    }
  });
  const [disableEditing, setDisableEditing] = useState(() => {
    try {
      const saved = localStorage.getItem('disableEditing');
      const value = saved ? JSON.parse(saved) : false;
      disableEditingRef.current = value; // Sync ref
      return value;
    } catch {
      return false;
    }
  });
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalQuestion, setModalQuestion] = useState('');
  const [modalCallback, setModalCallback] = useState(null);
  const [showModalEditor, setShowModalEditor] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState('success');
  const [notificationMessage, setNotificationMessage] = useState('');

  // Memoize user object to prevent socket reconnections
  const socketUser = useMemo(() => ({ user: userId }), [userId]);

  // Calculate table height based on fixedHeight setting
  // Reference: DsView.js lines 1872-1883, 1941
  const tableHeight = useMemo(() => {
    let fixedHeight = false;
    try {
      fixedHeight = viewConfig?.otherTableAttrs?.fixedHeight;
    } catch (e) {}
    
    if (fixedHeight) {
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      if (vh) {
        return `${vh - 50}px`;
      }
    }
    return undefined; // Let Tabulator auto-size
  }, [viewConfig]);

  // Handle cell unlock callback from socket (defined early to be used in socket hook)
  const handleCellUnlocked = useCallback((unlockedObj) => {
    // Additional processing after cell unlock
    if (tabulatorRef.current && !cellImEditingRef.current) {
      if (timersRef.current['post-cell-edited']) {
        clearTimeout(timersRef.current['post-cell-edited']);
      }
      timersRef.current['post-cell-edited'] = setTimeout(() => {
        if (!cellImEditingRef.current && tabulatorRef.current) {
          tabulatorRef.current.table.rowManager.adjustTableSize(false);
          // Call DOM helpers for rendering
          if (domHelpers.current) {
            domHelpers.current.normalizeAllImgRows();
            domHelpers.current.applyHighlightJsBadge();
            domHelpers.current.renderPlotlyInCells();
          }
        }
      }, 500);
    }
  }, []);

  // Socket.io for real-time collaboration
  // Use empty string for socket to connect to same origin (Vite proxy handles WebSocket)
  const { 
    connectedState, 
    dbConnectivityState, 
    lockedCells, 
    emitLock, 
    emitUnlock,
    isCellLocked 
  } = useDatasetSocket(dsName, dsView, socketUser, tabulatorRef, {
    apiUrl: '', // Connect to same origin, Vite proxy will forward WebSocket
    onCellUnlocked: handleCellUnlocked,
  });

  const clipboardHelpers = useRef(null);
  const domHelpers = useRef(null);
  const tabulatorConfigHelper = useRef(null);
  const jiraHelpers = useRef(null);
  const [columns, setColumns] = useState([]);
  // Prevent initial table mount until URL-derived filters/sorts/attrs are applied
  const [initialUrlProcessed, setInitialUrlProcessed] = useState(false);
  const lastGeneratedFilterAttrsRef = useRef('');

  // Initialize chronologyDescending from localStorage on mount
  // Reference: DsView.js lines 138-143
  // Default to true if never set (matching reference implementation)
  useEffect(() => {
    const chronologyDescendingFromLocal = localStorage.getItem('chronologyDescending');
    if (chronologyDescendingFromLocal === 'false') {
      setChronologyDescending(false);
    } else {
      // Default to true if null/undefined or any other value
      setChronologyDescending(true);
    }
  }, []);

  // Initialize fetchAllMatchingRecords from localStorage (per dataset view)
  useEffect(() => {
    try {
      const key = `fetchAllMatchingRecords:${dsName}:${dsView}`;
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        setFetchAllMatchingRecords(parsed);
        fetchAllMatchingRecordsRef.current = parsed;
      }
    } catch (e) {
      console.error('Error restoring fetchAllMatchingRecords from localStorage', e);
    }
  }, [dsName, dsView]);

  // Keep refs in sync so functions passed once to Tabulator can read latest values
  useEffect(() => { fetchAllMatchingRecordsRef.current = fetchAllMatchingRecords; }, [fetchAllMatchingRecords]);
  const chronologyDescendingRef = useRef(chronologyDescending);
  useEffect(() => { chronologyDescendingRef.current = chronologyDescending; }, [chronologyDescending]);

  // Process URL parameters for chronologyDescending
  // Reference: DsView.js lines 343-345, 439
  // URL params override localStorage
  useEffect(() => {
    const chronologyDescendingParam = searchParams.get('chronologyDescending');
    if (chronologyDescendingParam !== null) {
      const value = chronologyDescendingParam.toLowerCase() === 'true';
      setChronologyDescending(value);
      localStorage.setItem('chronologyDescending', JSON.stringify(value));
    }
  }, [searchParams]);

  // Process filter change - handle filter selection from FilterControls
  // Reference: DsView.js lines 1996-2037
  const processFilterChange = useCallback((filterName) => {
    // Build URL with filter and navigate
    const newUrl = filterName ? `/ds/${dsName}/${dsView}/${filterName}` : `/ds/${dsName}/${dsView}`;
    navigate(newUrl, { replace: true });
    // State will be updated by the useEffect that watches filterParam
  }, [dsName, dsView, navigate]);

  // Clicking the title should clear all filters (path and search params)
  const handleTitleClick = useCallback(() => {
    try {
      // Clear query string params
      setSearchParams({});
    } catch (e) {}

    // Navigate to base view path without any filter
    navigate(`/ds/${dsName}/${dsView}`, { replace: true });

    // Clear local filter state immediately so UI updates fast
    setFilter('');
    setInitialHeaderFilter([]);
    setInitialSort([]);
    setFilterColumnAttrs({});

    // Clear header filters and restore column attrs on the table shortly after
    setTimeout(() => {
      try {
        if (tabulatorRef.current?.table) {
          const existing = tabulatorRef.current.table.getHeaderFilters() || [];
          for (let j = 0; j < existing.length; j++) {
            const f = existing[j];
            if (f && f.field && typeof tabulatorRef.current.table.setHeaderFilterValue === 'function') {
              tabulatorRef.current.table.setHeaderFilterValue(f.field, null);
            }
          }
          // Show all columns and restore widths
          applyFilterColumnAttrs(tabulatorRef.current, {}, columnResizedRecentlyRef.current, originalColumnAttrsRef.current);
          // Clear sorters
          try { if (typeof tabulatorRef.current.table.clearSort === 'function') tabulatorRef.current.table.clearSort(); } catch (e) {}
        }
      } catch (e) {}
    }, 50);
  }, [dsName, dsView, navigate, setSearchParams]);
  
  // Handle column resize to set the flag
  const handleColumnResized = useCallback((column) => {
    columnResizedRecentlyRef.current = true;
    // Clear flag after 1 second
    setTimeout(() => {
      columnResizedRecentlyRef.current = false;
    }, 1000);
    
    // Redraw table
    if (tabulatorRef.current?.table) {
      tabulatorRef.current.table.redraw(true);
    }
  }, []);

  // Process search params (query string) and restore ad-hoc filter state
  // This mirrors the reference's processFilterViaUrl and takes precedence
  useEffect(() => {
    if (!viewConfig) return;
    const searchString = searchParams.toString();
    if (!searchString) return; // nothing to do
    if (lastProcessedSearchRef.current === searchString) return; // already handled

    const entries = Array.from(searchParams.entries());
    if (!entries.length) {
      lastProcessedSearchRef.current = searchString;
      return;
    }

    let hdrFilters = [];
    let hdrSorters = [];
    let colAttrs = {};
    let singleId = null;
    let pageSz = pageSize;
    let chronology = chronologyDescending;
    let fetchAll = fetchAllMatchingRecords;

    // Build column name list from viewConfig (support array or object shape)
    const columnNames = (() => {
      try {
        if (!viewConfig) return [];
        if (Array.isArray(viewConfig.columns)) return viewConfig.columns.map(c => (c && (c.field || c.name)) || c).filter(Boolean);
        if (typeof viewConfig.columns === 'object') return Object.keys(viewConfig.columns);
      } catch (e) {}
      return [];
    })();

    for (const [k, v] of entries) {
      if (k === '_id') { singleId = v; break; }
      if (k === 'hdrSorters') { try { hdrSorters = JSON.parse(v); } catch (e) { console.error('hdrSorters parse error', e); } continue; }
      if (k === 'filterColumnAttrs') { try { colAttrs = JSON.parse(v); } catch (e) { console.error('filterColumnAttrs parse error', e); } continue; }
      if (k === 'fetchAllMatchingRecords') { fetchAll = String(v).toLowerCase() === 'true'; continue; }
      if (k === 'pageSize') { const p = parseInt(v); if (p > 0) pageSz = p; continue; }
      if (k === 'chronologyDescending') { chronology = String(v).toLowerCase() === 'true'; continue; }
      if (columnNames.includes(k)) { hdrFilters.push({ field: k, value: v }); }
    }

    if (singleId) {
      // single-row mode: clear header filters and hide filter UI
      setFilter('');
      setInitialHeaderFilter([]);
      setShowAllFilters(false);
      // Keep singleId handling minimal here; other logic can read _id from URL when requesting data
    } else {
      setInitialHeaderFilter(hdrFilters);
      setInitialSort(hdrSorters);
      setFilterColumnAttrs(colAttrs);
      setShowAllFilters(hdrFilters.length > 0);
      setPageSize(pageSz);
      setChronologyDescending(chronology);
      setFetchAllMatchingRecords(fetchAll);
      fetchAllMatchingRecordsRef.current = fetchAll;

      // Apply column attrs and header filter values to Tabulator after state update
      setTimeout(() => {
        if (tabulatorRef.current?.table) {
          try {
            const existing = tabulatorRef.current.table.getHeaderFilters() || [];
            for (let j = 0; j < existing.length; j++) {
              const f = existing[j];
              if (f && f.field && typeof tabulatorRef.current.table.setHeaderFilterValue === 'function') {
                tabulatorRef.current.table.setHeaderFilterValue(f.field, null);
              }
            }

            applyFilterColumnAttrs(tabulatorRef.current, colAttrs, columnResizedRecentlyRef.current, originalColumnAttrsRef.current);

            if (Array.isArray(hdrFilters) && hdrFilters.length) {
              for (let i = 0; i < hdrFilters.length; i++) {
                const hf = hdrFilters[i];
                if (hf && hf.field && typeof tabulatorRef.current.table.setHeaderFilterValue === 'function') {
                  tabulatorRef.current.table.setHeaderFilterValue(hf.field, hf.value);
                }
              }
            }

            if (Array.isArray(hdrSorters) && hdrSorters.length) {
              try {
                tabulatorRef.current.table.setSort(hdrSorters);
              } catch (e) {
                console.error('Error applying hdrSorters from URL', e);
              }
            } else {
              try {
                if (typeof tabulatorRef.current.table.clearSort === 'function') {
                  tabulatorRef.current.table.clearSort();
                }
              } catch (e) {}
            }
          } catch (e) {
            console.error('Error applying URL filters/attrs', e);
          }
        }
      }, 50);
    }

    lastProcessedSearchRef.current = searchString;
  }, [searchParams, viewConfig]);

  // (removed premature marking here — we'll set `initialUrlProcessed` once columns are generated)

  // Process filter from URL - only when filterParam actually changes
  useEffect(() => {
    if (!viewConfig) return;
    // If a query string is present, it takes precedence over pathname-based saved filters
    if (searchParams.toString()) return;
    
    // Update filter state based on URL parameter
    if (filterParam) {
      const filterData = viewConfig.filters?.[filterParam];
      
      if (filterData) {
        // Deep clone filter data
        try {
          const hdrFilters = JSON.parse(JSON.stringify(filterData.hdrFilters || []));
          const hdrSorters = JSON.parse(JSON.stringify(filterData.hdrSorters || []));
          const colAttrs = JSON.parse(JSON.stringify(filterData.filterColumnAttrs || {}));
          
          setFilter(filterParam);
          setInitialHeaderFilter(hdrFilters);
          setInitialSort(hdrSorters);
          setFilterColumnAttrs(colAttrs);
          setShowAllFilters(true);
          
          // Apply filter column attributes after state update
          setTimeout(() => {
              if (tabulatorRef.current?.table) {
                try {
                  // Clear all existing header filters first so old regexes are removed
                  const existing = tabulatorRef.current.table.getHeaderFilters() || [];
                  for (let j = 0; j < existing.length; j++) {
                    const f = existing[j];
                    if (f && f.field && typeof tabulatorRef.current.table.setHeaderFilterValue === 'function') {
                      tabulatorRef.current.table.setHeaderFilterValue(f.field, null);
                    }
                  }

                  // Apply column visibility/width attrs (pass original attrs so widths can be restored when needed)
                  applyFilterColumnAttrs(tabulatorRef.current, colAttrs, columnResizedRecentlyRef.current, originalColumnAttrsRef.current);

                  // Now apply saved header filter values so Tabulator (and backend) perform filtering
                  if (Array.isArray(hdrFilters) && hdrFilters.length) {
                    for (let i = 0; i < hdrFilters.length; i++) {
                      const hf = hdrFilters[i];
                      if (hf && hf.field && typeof tabulatorRef.current.table.setHeaderFilterValue === 'function') {
                        tabulatorRef.current.table.setHeaderFilterValue(hf.field, hf.value);
                      }
                    }
                  }
                  // Apply saved sorters (hdrSorters) if present
                  if (Array.isArray(hdrSorters) && hdrSorters.length) {
                    try {
                      // Tabulator accepts sort entries like [{column: 'field', dir: 'asc'}]
                      tabulatorRef.current.table.setSort(hdrSorters);
                    } catch (e) {
                      console.error('Error applying saved sorters:', e);
                    }
                  } else {
                    // No saved sorters for this filter: clear any existing sort
                    try {
                      if (typeof tabulatorRef.current.table.clearSort === 'function') {
                        tabulatorRef.current.table.clearSort();
                      }
                    } catch (e) {
                      console.error('Error clearing sorters:', e);
                    }
                  }
                } catch (e) {
                  console.error('Error applying header filters or column attrs:', e);
                }
              }
          }, 100);
        } catch (e) {
          console.error('Error parsing filter data:', e);
        }
      } else {
        // Filter name in URL but no data found
        setFilter(filterParam);
        setInitialHeaderFilter([]);
        setInitialSort([]);
        setFilterColumnAttrs({});
      }
    } else {
      // No filter in URL - clear everything
      setFilter('');
      setInitialHeaderFilter([]);
      setInitialSort([]);
      setFilterColumnAttrs({});
      // Clear header filters and restore column attrs
      setTimeout(() => {
        if (tabulatorRef.current?.table) {
          try {
            const existing = tabulatorRef.current.table.getHeaderFilters() || [];
            for (let j = 0; j < existing.length; j++) {
              const f = existing[j];
              if (f && f.field && typeof tabulatorRef.current.table.setHeaderFilterValue === 'function') {
                tabulatorRef.current.table.setHeaderFilterValue(f.field, null);
              }
            }
            // Apply empty attrs to show all columns and restore original widths
            applyFilterColumnAttrs(tabulatorRef.current, {}, columnResizedRecentlyRef.current, originalColumnAttrsRef.current);
            // Clear sorters when filter cleared
            try {
              if (typeof tabulatorRef.current.table.clearSort === 'function') {
                tabulatorRef.current.table.clearSort();
              }
            } catch (e) {
              console.error('Error clearing sorters on filter clear:', e);
            }
          } catch (e) {
            console.error('Error clearing header filters:', e);
          }
        }
      }, 100);
    }
  }, [filterParam, viewConfig, searchParams]); // Respect viewConfig and searchParams for reload handling

  // If there is no URL pathname filter and no query string, we'll allow mount once columns are ready

  // Ajax helper functions (from reference implementation)
  const generateParamsList = useCallback((data, prefix = "") => {
    let output = [];
    
    if (Array.isArray(data)) {
      data.forEach((item, i) => {
        output = output.concat(generateParamsList(item, prefix ? prefix + "[" + i + "]" : i));
      });
    } else if (typeof data === "object" && data !== null) {
      for (let key in data) {
        output = output.concat(generateParamsList(data[key], prefix ? prefix + "[" + key + "]" : key));
      }
    } else {
      output.push({ key: prefix, value: data });
    }
    
    return output;
  }, []);

  const serializeParams = useCallback((params) => {
    const output = generateParamsList(params);
    const encoded = [];
    
    output.forEach((item) => {
      encoded.push(encodeURIComponent(item.key) + "=" + encodeURIComponent(item.value));
    });
    
    return encoded.join("&");
  }, [generateParamsList]);

  const ajaxURLGenerator = useCallback((url, config, params) => {
    try {
      if (!url) return url;
      if (!params || typeof params !== 'object') params = {};
      // Always attach our special params so server can return totals and reqCount
      params.fetchAllMatchingRecords = fetchAllMatchingRecordsRef.current;
      params.chronology = chronologyDescendingRef.current ? 'desc' : 'asc';
      params.reqCount = ++(reqCount.current);

      // Always append our params as query string so server can report totals
      if (!config) config = {};
      const qs = serializeParams(params);
      url += (url.includes('?') ? '&' : '?') + qs;
    } catch (e) {
      console.error('ajaxURLGenerator error', e);
    }
    return url;
  }, [fetchAllMatchingRecords, chronologyDescending, serializeParams]);

  const ajaxResponse = useCallback((url, params, response) => {
    try {
      // ajax response received; process below
      if (response == null) return response;
      const respReqCount = response.reqCount;
      // Optionally inspect response keys during debugging
      try { /* inspect response keys if needed */ } catch (e) {}
      const respReqCountNum = respReqCount == null ? undefined : Number(respReqCount);

      if (respReqCount == null || respReqCountNum === reqCount.current || respReqCountNum === 0) {
        // Try common field names for totals in case server uses a different key
        const totals = response.total ?? response.count ?? response.totalCount ?? response.totals ?? 0;
        const more = response.moreMatchingDocs ?? response.more ?? false;
        setTotalRecs(totals || 0);
        setMoreMatchingDocs(more || false);
      } else {
        // ignored stale response
      }
    } catch (e) {
      console.error('ajaxResponse handler error', e);
    }
    return response;
  }, []);

  // Restore fetchAllMatchingRecords from URL search params on load
  useEffect(() => {
    try {
      const val = searchParams.get('fetchAllMatchingRecords');
      if (val !== null) {
        const parsed = String(val).toLowerCase() === 'true';
        setFetchAllMatchingRecords(parsed);
        // Trigger table refresh so Tabulator uses new param
        setTimeout(() => { try { tabulatorRef.current?.table?.setData(); } catch (e) {} }, 50);
      }
    } catch (e) {
      console.error('Error restoring fetchAllMatchingRecords from URL', e);
    }
  }, [searchParams]);

  // Generate a view URL capturing current header filters, sorters, column attrs and options
  const urlGeneratorFunctionForView = useCallback((e, cell) => {
    try {
      // If in single-row view (no filters) we could fallback to row URL, but keep view-level URL here
      const table = tabulatorRef.current?.table;
      if (!table) return;

      const currentHeaderFilters = table.getHeaderFilters() || [];
      const queryParamsObject = {};

      for (const hf of currentHeaderFilters) {
        if (hf && hf.field && hf.value != null && hf.value !== '' && hf.type === 'like') {
          queryParamsObject[hf.field] = hf.value;
        }
      }

      // Sorters
      const hdrSortersTmp = table.getSorters() || [];
      const hdrSorters = hdrSortersTmp.map(s => ({ column: s.field, dir: s.dir }));
      if (hdrSorters.length) queryParamsObject['hdrSorters'] = JSON.stringify(hdrSorters);

      // Column attrs (visibility / width)
      const cols = table.getColumns() || [];
      const filterColumnAttrsObj = {};
      for (let i = 0; i < cols.length; i++) {
        const field = cols[i].getField();
        const attrsForField = {};
        if (!cols[i].isVisible()) attrsForField.hidden = true;
        attrsForField.width = cols[i].getWidth();
        filterColumnAttrsObj[field] = attrsForField;
      }
      queryParamsObject['filterColumnAttrs'] = JSON.stringify(filterColumnAttrsObj);

      // fetchAllMatchingRecords, pageSize, chronology
      queryParamsObject['fetchAllMatchingRecords'] = fetchAllMatchingRecords ? true : false;
      queryParamsObject['pageSize'] = table.getPageSize ? (table.getPageSize() || pageSize) : pageSize;
      queryParamsObject['chronologyDescending'] = chronologyDescending ? true : false;

      const queryParams = new URLSearchParams(Object.entries(queryParamsObject));
      let finalUrl = window.location.origin + window.location.pathname;
      if (queryParams.toString()) finalUrl += '?' + queryParams.toString();

      // Use clipboard helper if available
      let copied = false;
      try {
        if (clipboardHelpers.current && typeof clipboardHelpers.current.copyTextToClipboard === 'function') {
          copied = clipboardHelpers.current.copyTextToClipboard(finalUrl);
        }
      } catch (e) {
        copied = false;
      }

      if (!copied) {
        try {
          if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(finalUrl);
            copied = true;
          }
        } catch (e) {
          copied = false;
        }
      }

      // Provide user feedback via modal
      if (copied) {
        setModalTitle('Copy URL');
        setModalQuestion('URL copied to clipboard');
        setModalCallback(null);
        setShowModal(true);
      } else {
        setModalTitle('Copy URL');
        setModalQuestion(finalUrl);
        setModalCallback(null);
        setShowModal(true);
      }
    } catch (e) {
      console.error('urlGeneratorFunctionForView error', e);
    }
  }, [tabulatorRef, fetchAllMatchingRecords, pageSize, chronologyDescending]);

  // Delete all rows matching current header filters - preview (pretend) and confirm
  const deleteAllRowsInQuery = useCallback(async () => {
    try {
      const table = tabulatorRef.current?.table;
      if (!table) {
        setNotificationType('error');
        setNotificationMessage('Table not initialized');
        setShowNotification(true);
        return;
      }

      const filters = table.getHeaderFilters ? (table.getHeaderFilters() || []) : [];
      const baseUrl = `${API_URL}/ds/deleteFromQuery/${dsName}/${dsView}/${userId}`;
      const previewUrl = ajaxURLGenerator(baseUrl, {}, { filters, pretend: true });

      // Preview POST
      let previewJson = null;
      try {
        const resp = await fetch(previewUrl, { method: 'post', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        if (!resp.ok) throw new Error('Preview failed');
        previewJson = await resp.json();
      } catch (err) {
        console.error('deleteAllRowsInQuery preview error', err);
        setNotificationType('error');
        setNotificationMessage('Preview failed');
        setShowNotification(true);
        return;
      }

      const total = previewJson?.total ?? 0;
      const more = previewJson?.moreMatchingDocs ?? false;

      const question = `This will delete ${total} rows${more ? ' (and more matches on server)' : ''}. Please confirm.`;
      setModalTitle('Delete all rows in query?');
      setModalQuestion(question);

      // Set callback for confirm button
      setModalCallback(() => async () => {
        try {
          const deleteUrl = ajaxURLGenerator(baseUrl, {}, { filters, pretend: false });
          const resp = await fetch(deleteUrl, { method: 'post', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
          if (!resp.ok) throw new Error('Delete failed');
          const result = await resp.json();

          setNotificationType('success');
          setNotificationMessage('Delete completed');
          setShowNotification(true);
          setShowModal(false);
          try { tabulatorRef.current?.table?.setData(); } catch (e) { console.error(e); }
        } catch (err) {
          console.error('deleteAllRowsInQuery error', err);
          setNotificationType('error');
          setNotificationMessage('Delete failed');
          setShowNotification(true);
          setShowModal(false);
        }
      });

      setShowModal(true);
    } catch (e) {
      console.error('deleteAllRowsInQuery outer error', e);
    }
  }, [tabulatorRef, API_URL, dsName, dsView, userId, ajaxURLGenerator]);

  // Cell edit check - controls single-click editing based on checkbox state
  // Reference: DsView.js lines 1014-1020
  // Uses refs to always check current state, not captured closure values
  const cellEditCheck = useCallback((cell) => {
    if (!singleClickEditRef.current) return false;  // Checkbox unchecked = no single-click edit
    if (disableEditingRef.current) return false;
    if (!connectedState) return false;      // Not connected to socket
    if (!dbConnectivityState) return false; // No DB connectivity
    // TODO: Add concurrent edit conflict checks (cellEditCheckForConflicts)
    // TODO: Check for mouseDownOnHtmlLink, mouseDownOnBadgeCopyIcon
    return true;
  }, [connectedState, dbConnectivityState]);

  // Cell force edit trigger - called when user clicks/focuses a cell
  // This should check if editing is allowed and then force the edit
  const cellForceEditTrigger = useCallback((cell, e) => {
    // Check all conditions using same logic as cellEditCheck
    if (!singleClickEditRef.current) return;  // Checkbox unchecked = no single-click edit
    if (disableEditingRef.current) return;
    if (!connectedState) return;      // Not connected to socket
    if (!dbConnectivityState) return; // No DB connectivity
    if (cellImEditingRef.current === cell) return;
    // TODO: Add concurrent edit conflict checks (cellEditCheckForConflicts)
    // TODO: Check for mouseDownOnHtmlLink, mouseDownOnBadgeCopyIcon
    // Force the edit by calling cell.edit(true)
    cell.edit(true, e);
  }, [connectedState, dbConnectivityState]);

  // Handle cell click/double-click events
  // Reference: DsView.js lines 906-912
  const cellClickEvents = useCallback((e, cell) => {
    if (!connectedState || !dbConnectivityState) return;

    // Double-click editing when single-click edit is OFF
    if (e.type === 'dblclick' && !singleClickEditRef.current && !disableEditingRef.current) {
      if (cellImEditingRef.current === cell) return;
      // TODO: Add cellEditCheckForConflicts check
      // Force edit on double-click bypassing cellEditCheck
      cell.edit(true, e);
    }
  }, [connectedState, dbConnectivityState]);

  // Handler for checkbox change
  const handleSingleClickEditToggle = useCallback((event) => {
    const checked = event.target.checked;
    singleClickEditRef.current = checked; // Sync ref
    setSingleClickEdit(checked);
    localStorage.setItem('singleClickEdit', JSON.stringify(checked));
  }, []);

  // Toggle functions for checkboxes
  const toggleFilters = useCallback(() => {
    setShowAllFilters(prev => {
      const newValue = !prev;
      localStorage.setItem('showAllFilters', JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  const toggleEditing = useCallback((shouldDisable) => {
    // Dynamically toggle column editors based on shouldDisable parameter
    // Reference: DsView.js lines 726-755
    if (tabulatorRef.current?.table && originalColumnAttrsRef.current) {
      const currentDefs = tabulatorRef.current.table.getColumnDefinitions();
      
      // Modify column definitions in place
      for (let j = 0; j < currentDefs.length; j++) {
        const originalCol = originalColumnAttrsRef.current[j];
        
        if (shouldDisable) {
          // Disabling: Set all editors to false
          currentDefs[j].editor = false;
        } else {
          // Enabling: Restore original editor from viewConfig
          if (originalCol && originalCol.editor) {
            let restoredEditor = originalCol.editor;
            
            // Map string editor names to function references
            if (restoredEditor === 'textarea') {
              restoredEditor = MyTextArea;
            } else if (restoredEditor === 'codemirror') {
              restoredEditor = MyCodeMirror;
            } else if (restoredEditor === 'date') {
              restoredEditor = DateEditor;
            } else if (restoredEditor === 'autocomplete') {
              // Check for multiselect in editorParams
              if (originalCol.editorParams?.multiselect) {
                restoredEditor = MyAutoCompleter;
              } else {
                restoredEditor = MySingleAutoCompleter;
              }
            }
            
            currentDefs[j].editor = restoredEditor;
          }
        }
      }
      
      // Directly update Tabulator columns without triggering React re-render
      // This avoids backend calls that would happen with setColumns(updatedDefs)
      tabulatorRef.current.table.setColumns(currentDefs);
    }
  }, []);

  const toggleFetchAllRecords = useCallback(() => {
    setFetchAllMatchingRecords(prev => {
      const next = !prev;
      try {
        // Persist choice in localStorage per dataset/view
        const key = `fetchAllMatchingRecords:${dsName}:${dsView}`;
        localStorage.setItem(key, JSON.stringify(next));
      } catch (e) {}

      // Force tabulator to reload from page 1 with new params
      setTimeout(() => {
        try {
          if (tabulatorRef.current?.table) {
            if (typeof tabulatorRef.current.table.setPage === 'function')
              tabulatorRef.current.table.setPage(1);
            tabulatorRef.current.table.setData();
          }
        } catch (e) { console.error('toggleFetchAllRecords refresh error', e); }
      }, 20);

      return next;
    });
  }, []);

  // Cell editing handler
  const handleCellEditing = useCallback((cell) => {
    const _id = cell.getRow().getData()._id;
    const field = cell.getField();

    // Skip locking for new rows (no _id yet)
    if (!_id) {
      cellImEditingRef.current = cell;
      return true; // Allow edit
    }

    // Check if cell is locked by another user
    if (isCellLocked(_id, field)) {
      return false; // Cancel edit
    }

    // Emit lock event
    emitLock({ dsName, _id, field, user: auth.user?.user });
    cellImEditingRef.current = cell;

    return true; // Allow edit
  }, [dsName, isCellLocked, emitLock, auth.user]);

  // Cell edit cancelled handler
  const handleCellEditCancelled = useCallback((cell) => {
    const _id = cell.getRow().getData()._id;
    const field = cell.getField();
    const oldVal = cell.getOldValue();

    // Skip unlocking for new rows (no _id yet)
    if (_id) {
      // Emit unlock when edit is cancelled (e.g., Escape key)
      emitUnlock({ dsName, _id, field, newVal: oldVal, user: auth.user?.user });
    }
    cellImEditingRef.current = null;
  }, [dsName, emitUnlock, auth.user]);

  // Cell edited handler
  const handleCellEdited = useCallback((cell) => {
    const rowData = cell.getRow().getData();
    const _id = rowData._id;
    const field = cell.getField();
    const newVal = cell.getValue();
    const oldVal = cell.getOldValue();

    // Normalize row height immediately (synchronously)
    cell.getRow().normalizeHeight();

    // Check if this is a new row (no _id) - Reference: DsView.js lines 1111-1180
    if (!_id) {
      // This is a new row that needs to be inserted to backend
      // Build key object from configured key fields
      const keyObj = {};
      const keys = viewConfig?.keys || [];
      
      // Collect key field values
      for (const key of keys) {
        if (rowData[key] !== undefined && rowData[key] !== null && rowData[key] !== '') {
          keyObj[key] = rowData[key];
        }
      }
      
      // Ensure at least one key field is populated before inserting
      if (Object.keys(keyObj).length === 0) {
        console.log('New row: waiting for key fields to be populated');
        cellImEditingRef.current = null;
        return;
      }
      
      // Insert the new row to backend
      // Backend expects: dsName, dsView, dsUser, selectorObj (key fields), doc (full row data)
      const payload = {
        dsName,
        dsView,
        dsUser: userId,
        selectorObj: keyObj,  // Only the key fields
        doc: rowData,         // Complete row data
      };
      
      const uiRow = cell.getRow();
      
      insertRowMutation.mutate(
        payload,
        {
          onSuccess: (result) => {
            console.log('New row inserted successfully:', result);
            
            // Update the UI row with the _id from backend
            if (result._id) {
              uiRow.update({ _id: result._id });
            }
            
            setNotificationType('success');
            setNotificationMessage('Row added successfully');
            setShowNotification(true);
          },
          onError: (error) => {
            console.error('insertRow API error', error);
            setNotificationType('error');
            setNotificationMessage(`Failed to add row: ${error.message}`);
            setShowNotification(true);
            
            // Optionally remove the row from UI on failure
            // uiRow.delete();
          },
        }
      );
      
      cellImEditingRef.current = null;
      return;
    }

    if (newVal === oldVal) {
      // No change, just unlock
      emitUnlock({ dsName, _id, field, newVal, user: auth.user?.user });
      cellImEditingRef.current = null;
      return;
    }

    // Dispatch edit start action
    dispatchEdit({
      type: EDIT_ACTION_TYPES.EDIT_START,
      _id,
      editTracker: { _id, field, oldVal, newVal },
    });

    // Call API to save edit
    // Match reference implementation payload shape
    const selectorObj = { _id, [field]: oldVal };
    const editObj = { [field]: newVal };
    const payload = {
      dsName,
      dsView,
      dsUser: userId,
      column: field,
      selectorObj,
      editObj,
    };
    
    // Store cell reference to check later if still valid
    const editedCell = cell;
    
    editCellMutation.mutate(
      payload,
      {
        onSuccess: (result) => {
          dispatchEdit({
            type: EDIT_ACTION_TYPES.EDIT_SUCCESS,
            _id,
            serverStatus: result,
            editTracker: { _id, field, oldVal, newVal },
          });
          
          // Emit unlock with new value
          emitUnlock({ dsName, _id, field, newVal, user: auth.user?.user });
          cellImEditingRef.current = null;

          // Show success notification
          setNotificationType('success');
          setNotificationMessage('Cell updated successfully');
          setShowNotification(true);
          
          // Note: Do NOT call cell.setValue() or other cell methods here
          // The cell is no longer in edit mode by the time this async callback runs
        },
        onError: (error) => {
          console.error('editCell API error', error);
          dispatchEdit({
            type: EDIT_ACTION_TYPES.EDIT_FAILURE,
            _id,
            editTracker: { _id, field, oldVal, newVal },
            error: error.message,
          });

          // Only try to restore value if cell is still being edited
          // Check if this is still the current cell being edited
          if (cellImEditingRef.current === editedCell) {
            // Cell is still in edit mode, safe to restore
            if (typeof editedCell.restoreOldValue === 'function') {
              editedCell.restoreOldValue();
            } else {
              editedCell.setValue(oldVal);
            }
          }
          // If cell is no longer being edited, the table state already has the old value
          // so we don't need to do anything

          // Emit unlock
          emitUnlock({ dsName, _id, field, newVal: oldVal, user: auth.user?.user });
          cellImEditingRef.current = null;

          // Show error notification
          setNotificationType('error');
          setNotificationMessage(`Edit failed: ${error.message}`);
          setShowNotification(true);
        },
      }
    );
  }, [dsName, dsView, userId, viewConfig, editCellMutation, insertRowMutation, emitUnlock, auth.user]);

  // Add row handler
  // Reference: DsView.js lines 1971-2001
  // Adds a temporary row to Tabulator (no backend call yet)
  // When user edits a cell in the new row, handleCellEdited will detect
  // the missing _id and trigger the actual insertRow API call
  const handleAddRow = useCallback(async () => {
    if (!tabulatorRef.current?.table) return;
    
    // Create empty row
    const newRow = {};
    
    // Add user-name if per-row access control is enabled
    try {
      if (viewConfig?.perRowAccessConfig?.enabled && viewConfig?.perRowAccessConfig?.column) {
        newRow[viewConfig.perRowAccessConfig.column] = auth.user?.user;
      }
    } catch (e) {
      console.error('Error setting per-row access:', e);
    }
    
    // Add row to Tabulator (no _id yet, will be added by backend later)
    // pos=true means add at bottom of table
    try {
      await tabulatorRef.current.table.addRow(newRow, true, null);
      console.log('Temporary row added to table');
    } catch (error) {
      console.error('Error adding row to table:', error);
      setNotificationType('error');
      setNotificationMessage('Failed to add row to table');
      setShowNotification(true);
    }
  }, [tabulatorRef, viewConfig, auth.user]);

  // Copy to clipboard handler
  const handleCopyToClipboard = useCallback(() => {
    if (tabulatorRef.current && clipboardHelpers.current) {
      clipboardHelpers.current.copyToClipboard(tabulatorRef.current);
    }
  }, []);

  // Delete row handler
  const handleDeleteRow = useCallback((_id) => {
    setModalTitle('Confirm Delete');
    setModalQuestion('Are you sure you want to delete this row?');
    setModalCallback(() => () => {
      deleteRowMutation.mutate(
        {
          dsName,
          dsView,
          dsUser: userId,
          _id,
        },
        {
          onSuccess: () => {
            setNotificationType('success');
            setNotificationMessage('Row deleted successfully');
            setShowNotification(true);
            setShowModal(false);
          },
          onError: (error) => {
            setNotificationType('error');
            setNotificationMessage(`Failed to delete row: ${error.message}`);
            setShowNotification(true);
            setShowModal(false);
          },
        }
      );
    });
    setShowModal(true);
  }, [dsName, dsView, userId, deleteRowMutation]);

  // Handlers object for tabulatorConfig (defined after all handler functions)
  const handlers = useMemo(() => ({
    cellEditCheck: cellEditCheck,
    cellForceEditTrigger: cellForceEditTrigger, // Separate function that triggers edit
    isKey: (field) => viewConfig?.keys?.includes(field) || false,
    toggleSingleFilter: () => {}, // TODO
    freezeColumn: () => {}, // TODO
    unfreezeColumn: () => {}, // TODO
    hideColumn: () => {}, // TODO
    hideColumnFromCell: () => {}, // TODO
    showAllCols: () => {}, // TODO
    copyCellToClipboard: () => {}, // TODO
    startPreso: () => {}, // Deferred
    urlGeneratorFunction: urlGeneratorFunctionForView,
    duplicateAndAddRowHandler: () => {}, // TODO
    addRow: handleAddRow,
    deleteAllRowsInViewQuestion: () => {}, // TODO
    deleteAllRowsInQuery: deleteAllRowsInQuery,
    deleteRowQuestion: () => {}, // TODO
    deleteColumnQuestion: () => {}, // TODO
    addColumnQuestion: () => {}, // TODO
    downloadXlsx: () => {}, // TODO
    convertToJiraRow: () => {}, // Deferred
    addJiraRow: () => {}, // Deferred
    isJiraRow: () => false, // Deferred
    showAllFilters: showAllFilters,
  }), [handleCellEditing, handleAddRow, viewConfig, showAllFilters, cellEditCheck, cellForceEditTrigger]);

  // Initialize helper modules and generate columns
  useEffect(() => {
    if (!viewConfig) return;

    // Store original columnAttrs for editor restoration when toggling editing
    if (!originalColumnAttrsRef.current && viewConfig.columnAttrs) {
      originalColumnAttrsRef.current = JSON.parse(JSON.stringify(viewConfig.columnAttrs));
    }

    const helperContext = {
      tabulatorRef,
      viewConfig,
      dsName,
      dsView,
      userId,
      handlers,
      cellImEditingRef,
      frozenCol,
      filterColumnAttrs,
      columnResizedRecently: columnResizedRecentlyRef.current,
      originalColumnAttrs: originalColumnAttrsRef.current,
      // Editor functions for Tabulator columns
      MyTextArea,
      MyCodeMirror,
      DateEditor,
      MyAutoCompleter,
      MySingleAutoCompleter,
    };

    clipboardHelpers.current = createClipboardHelpers(helperContext);
    domHelpers.current = createDomHelpers(helperContext);
    tabulatorConfigHelper.current = createTabulatorConfig(helperContext);
    jiraHelpers.current = createJiraHelpers(helperContext);
    
    // Generate columns using tabulatorConfig
    if (tabulatorConfigHelper.current) {
      const generatedColumns = tabulatorConfigHelper.current.setColumnDefinitions();
      setColumns(generatedColumns);
      try {
        lastGeneratedFilterAttrsRef.current = JSON.stringify(filterColumnAttrs || {});
      } catch (e) {
        lastGeneratedFilterAttrsRef.current = '';
      }
    }
  }, [viewConfig, dsName, dsView, userId, connectedState, dbConnectivityState, showAllFilters, filterColumnAttrs]);

  // Once column definitions (including saved filter attrs) are generated, allow table to mount
  useEffect(() => {
    if (!initialUrlProcessed && viewConfig && Array.isArray(columns) && columns.length > 0) {
      try {
        const currentAttrs = JSON.stringify(filterColumnAttrs || {});
        if (lastGeneratedFilterAttrsRef.current === currentAttrs) {
          setInitialUrlProcessed(true);
        }
      } catch (e) {
        setInitialUrlProcessed(true);
      }
    }
  }, [columns, viewConfig, initialUrlProcessed]);

  // Rebuild Tabulator columns when `showAllFilters` toggles so header filters are applied
  useEffect(() => {
    if (!viewConfig || !tabulatorConfigHelper.current) return;

    try {
      const generatedColumns = tabulatorConfigHelper.current.setColumnDefinitions();
      setColumns(generatedColumns);

      // If table already initialized, apply new column defs directly
      if (tabulatorRef.current?.table) {
        tabulatorRef.current.table.setColumns(generatedColumns);
      }
    } catch (e) {
      console.error('Error rebuilding columns on showAllFilters change:', e);
    }
  }, [showAllFilters, viewConfig, filterColumnAttrs]);


  // TODO: Implement remaining handlers:
  // - handleAddColumn
  // - handleDeleteColumn
  // - handleDownloadXlsx
  // - handleRefreshJira
  // - handleConvertToJira
  // - URL filtering
  // - Filter controls
  // - And all other methods from the original 2,360-line component

  if (isLoading) {
    return <div className={styles.loading}>Loading dataset view...</div>;
  }

  if (isError) {
    return <div className={styles.error}>Error loading view: {error?.message}</div>;
  }

  if (!viewConfig) {
    return <div className={styles.error}>No view configuration found</div>;
  }

  return (
    <div className={styles.container}>
      <Row>
        <Col>
          <div className={styles.header}>
            <h2
              className={styles.title}
              role="button"
              tabIndex={0}
              onClick={handleTitleClick}
              onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTitleClick(); }}
            >
              {dsName} - {dsView}
            </h2>
            <div className={styles.connectivityStatus}>
              <span className={styles.statusIndicator}>Socket: {connectedState ? '🟢' : '🔴'}</span>
              <span className={styles.statusIndicator}>DB: {dbConnectivityState ? '🟢' : '🔴'}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className={styles.actionBar}>
            <button className={styles.btnLink} onClick={handleCopyToClipboard}>
              Copy-to-clipboard <i className='fas fa-clipboard'></i>
            </button>
            <span className={styles.separator}>|</span>
            <button className={styles.btnLink} onClick={handleAddRow}>
              Add Row <i className='fas fa-plus'></i>
            </button>
          </div>

          {/* Settings checkboxes */}
          <div className={styles.settingsBar}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={chronologyDescending}
                onChange={(e) => {
                  setChronologyDescending(e.target.checked);
                  localStorage.setItem('chronologyDescending', JSON.stringify(e.target.checked));
                  setForceRefresh(prev => prev + 1); // Increment counter to trigger table refresh
                }}
              />
              Desc order <i className='fas fa-level-down-alt'></i>
            </label>
            <span className={styles.separator}>|</span>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={showAllFilters}
                onChange={(e) => {
                  setShowAllFilters(e.target.checked);
                  localStorage.setItem('showAllFilters', JSON.stringify(e.target.checked));
                }}
              />
              Show filters <i className='fas fa-filter'></i>
            </label>
            <span className={styles.separator}>|</span>
            <label className={styles.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={singleClickEdit} 
                onChange={handleSingleClickEditToggle}
              />
              &nbsp;1-click editing <i className='fas fa-bolt'></i>
            </label>
            <span className={styles.separator}>|</span>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={disableEditing}
                onChange={(e) => {
                  const checked = e.target.checked;
                  disableEditingRef.current = checked; // Sync ref
                  setDisableEditing(checked);
                  localStorage.setItem('disableEditing', JSON.stringify(checked));
                  toggleEditing(checked);
                }}
              />
              Disable Editing <i className='fas fa-ban'></i>
            </label>
          </div>

          {/* FilterControls component */}
          <FilterControls
            show={showAllFilters}
            dsName={dsName}
            dsView={dsView}
            tableRef={tabulatorRef.current}
            onFilterChange={processFilterChange}
            defaultValue={filter}
            viewConfig={viewConfig}
          />

          {/* Total records display */}
          <div className={styles.infoBar}>
            {tabulatorRef.current?.table?.getHeaderFilters()?.length > 0 ? (
              fetchAllMatchingRecords ? (
                <b className={styles.totalCount}><i className={`fas fa-clone ${styles.totalIcon}`}></i> Total matching records: {totalRecs}</b>
              ) : (
                moreMatchingDocs ? (
                  <b className={styles.totalCount}><i className={`fas fa-clone ${styles.totalIcon}`}></i> Top matching records: {totalRecs - 1}+</b>
                ) : (
                  <b className={styles.totalCount}><i className={`fas fa-clone ${styles.totalIcon}`}></i> Top matching records: {totalRecs}</b>
                )
              )
            ) : (
              <b className={styles.totalCount}><i className={`fas fa-clone ${styles.totalIcon}`}></i> Total records: {totalRecs}</b>
            )}
            
            {tabulatorRef.current?.table?.getHeaderFilters()?.length > 0 && (
              <>
                <span className={styles.separator}>|</span>
                <button className="btn btn-link" onClick={toggleFetchAllRecords}>
                  <i className='fa fa-download'></i>
                  {fetchAllMatchingRecords ? 'Fetch top matches only' : 'Fetch all matches'}
                </button>
              </>
            )}
            
            <span className={styles.separator}>|</span>
            <button className="btn btn-link" onClick={() => tabulatorRef.current?.table?.setData()}>
              <i className='fas fa-redo'></i><b className={styles.refreshLabel}>Refresh</b>
            </button>
          </div>

          {initialUrlProcessed && (
          <MyTabulator
            innerref={(ref) => (tabulatorRef.current = ref)}
            columns={columns}
            data={[]}
            options={{
              height: tableHeight,
              layout: 'fitDataStretch',
              pagination: 'remote',
              paginationSize: pageSize,
              chronology: chronologyDescending ? 'desc' : 'asc', // Triggers shouldComponentUpdate
              cellClick: cellClickEvents,
              cellDblClick: cellClickEvents,
              forceRefresh: forceRefresh, // Triggers shouldComponentUpdate
              ajaxURL: `${API_URL}/ds/view/${dsName}/${dsView}/${userId}`,
              ajaxURLGenerator: ajaxURLGenerator,
              ajaxResponse: ajaxResponse,
              ajaxConfig: {
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include'
              },
              paginationDataSent: {
                page: 'page',
                size: 'per_page'
              },
              paginationDataReceived: {
                last_page: 'total_pages'
              },
              ajaxError: (error) => {
                console.error('ajaxError', error);
              },
              ajaxSorting: true,
              ajaxFiltering: true,
              // Apply saved filter header filters
              initialHeaderFilter: initialHeaderFilter,
              // Apply saved filter sort order
              initialSort: initialSort,
              // Row formatter to style unsaved rows (no _id) with different background
              // Reference: DsView.js lines 1962-1968
              // Uses CSS variables to match current theme with accent color for contrast
              rowFormatter: (row) => {
                const rootStyles = getComputedStyle(document.documentElement);
                const rowElement = row.getElement();
                
                if (!row.getData()._id) {
                  // New unsaved row - use accent color with transparency + left border for high visibility
                  const accentColor = rootStyles.getPropertyValue('--color-accent').trim();
                  rowElement.style.backgroundColor = `${accentColor}22`; // 22 = ~13% opacity in hex
                  rowElement.style.borderLeft = `4px solid ${accentColor}`;
                } else {
                  // Saved row - use normal background color from theme
                  rowElement.style.backgroundColor = rootStyles.getPropertyValue('--color-bg').trim();
                  rowElement.style.borderLeft = 'none';
                }
              },
              // Track manual column resizes to prevent conflicts with filter column widths
              columnResized: handleColumnResized,
              // TODO: Add more options from original
            }}
            cellEditing={handleCellEditing}
            cellEdited={handleCellEdited}
            cellEditCancelled={handleCellEditCancelled}
          />
          )}

          {/* Notification */}
          <Notification
            show={showNotification}
            type={notificationType}
            message={notificationMessage}
            onClose={() => setShowNotification(false)}
            autoHideDuration={3000}
          />

          {/* Confirmation Modal */}
          {showModal && (
            <Modal
              title={modalTitle}
              message={modalQuestion}
              onConfirm={() => {
                if (modalCallback) modalCallback();
              }}
              onCancel={() => setShowModal(false)}
            />
          )}

          {/* TODO: Add ModalEditor */}
          {/* TODO: Add JiraForm */}
          {/* TODO: Add ColorPicker */}
        </Col>
      </Row>
    </div>
  );
}

export default DsViewPage;
